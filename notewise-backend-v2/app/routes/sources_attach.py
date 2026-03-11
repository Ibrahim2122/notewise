"""
app/routes/sources_attach.py

Every endpoint validates that:
  1. The source exists
  2. The source's workspace is owned by the requesting user (JWT → current_user)

Ownership is checked by joining Source → Workspace and comparing user_id.
A wrong-owner request gets 404 (not 403) to avoid leaking whether an ID exists.

SAS path tampering is prevented in /upload-complete by re-deriving the
expected path server-side and comparing it to what the client sent.
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, cast, String
from sqlalchemy.orm import Session

from app.config import settings
from app.db.db import get_db
from app.db.models.artifact import Artifact
from app.db.models.source import Source, SourceType, SourceStatus
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.dependencies.auth import get_current_user
from app.schemas.source import SourceRead
from app.schemas.attach_schemas import AttachTextIn, AttachLinkIn
from app.schemas.source_upload import (
    UploadUrlResponse,
    UploadCompleteIn,
    UploadCompleteResponse,
    SourceStatusResponse,
)
from app.storage.azure_blob import ensure_container, generate_upload_sas_url
from app.storage.paths import source_blob_path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])

BINARY_SOURCE_TYPES = {SourceType.PDF, SourceType.AUDIO}
_DEFAULT_EXT = {SourceType.PDF: "pdf", SourceType.AUDIO: "audio"}


# ---------------------------------------------------------------------------
# Ownership-aware helpers
# ---------------------------------------------------------------------------

def _get_owned_source_or_404(
    db: Session,
    source_id: uuid.UUID,
    current_user: User,
) -> Source:
    user_id_str = str(current_user.id)
    logger.debug(
        "Ownership check: source_id=%s  user.id=%r  user_id_str=%r",
        source_id, current_user.id, user_id_str,
    )

    result = db.execute(
        select(Source)
        .join(Workspace, Workspace.id == Source.workspace_id)
        .where(
            Source.id == source_id,
            cast(Workspace.user_id, String) == user_id_str,
        )
    ).scalar_one_or_none()

    if not result:
        # Log what the workspace actually stores so we can spot the mismatch
        stored_user_id = db.execute(
            select(Workspace.user_id)
            .join(Source, Source.workspace_id == Workspace.id)
            .where(Source.id == source_id)
        ).scalar_one_or_none()
        logger.warning(
            "404: source %s exists but Workspace.user_id=%r != current_user.id=%r",
            source_id, stored_user_id, user_id_str,
        )
        raise HTTPException(status_code=404, detail="Source not found")

    return result


def _ensure_type(source: Source, expected: SourceType) -> None:
    if source.source_type != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source type must be {expected.value}",
        )


def _ensure_binary_type(source: Source) -> None:
    if source.source_type not in BINARY_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Endpoint only valid for binary source types: {[t.value for t in BINARY_SOURCE_TYPES]}",
        )


def _canonical_blob_path(source: Source, current_user: User) -> str:
    ext = _DEFAULT_EXT.get(source.source_type, "bin")
    return source_blob_path(
        user_id=str(current_user.id),
        workspace_id=source.workspace_id,
        source_id=source.id,
        ext=ext,
    )


# ---------------------------------------------------------------------------
# GET /{source_id}  —  polling
# ---------------------------------------------------------------------------

@router.get("/{source_id}", response_model=SourceStatusResponse)
async def get_source_status(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)

    latest_summary: str | None = None
    if source.status == SourceStatus.DONE:
        artifact = db.execute(
            select(Artifact)
            .where(
                Artifact.source_id == source_id,
                Artifact.artifact_type == "SUMMARY",
            )
            .order_by(Artifact.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if artifact:
            latest_summary = artifact.content

    return SourceStatusResponse(
        id=source.id,
        status=source.status.value,
        latest_summary=latest_summary,
    )


# ---------------------------------------------------------------------------
# POST /{source_id}/upload-url  —  Step 1: get a write-only SAS URL
# ---------------------------------------------------------------------------

@router.post("/{source_id}/upload-url", response_model=UploadUrlResponse)
async def request_upload_url(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)
    _ensure_binary_type(source)

    blob_path = _canonical_blob_path(source, current_user)
    ensure_container(settings.AZURE_BLOB_CONTAINER)
    upload_url, expires_in_seconds = generate_upload_sas_url(blob_path)

    return UploadUrlResponse(
        id=source.id,
        blob_path=blob_path,
        upload_url=upload_url,
        expires_in_seconds=expires_in_seconds,
    )


# ---------------------------------------------------------------------------
# POST /{source_id}/upload-complete  —  Step 2: finalize after frontend PUT
# ---------------------------------------------------------------------------

@router.post("/{source_id}/upload-complete", response_model=UploadCompleteResponse)
async def finalize_upload(
    source_id: uuid.UUID,
    payload: UploadCompleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)
    _ensure_binary_type(source)

    expected = _canonical_blob_path(source, current_user)
    if payload.blob_path != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"blob_path does not match expected path for this source. Expected: {expected}",
        )

    source.storage_uri       = payload.blob_path
    source.mime_type         = payload.mime_type
    source.original_filename = payload.original_filename
    source.status            = SourceStatus.PENDING

    db.commit()
    db.refresh(source)

    return UploadCompleteResponse(
        id=source.id,
        storage_uri=source.storage_uri,
        status=source.status.value,
    )


# ---------------------------------------------------------------------------
# DELETE /{source_id}
# ---------------------------------------------------------------------------

@router.delete("/{source_id}", status_code=204)
async def delete_source(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)
    db.delete(source)
    db.commit()


# ---------------------------------------------------------------------------
# PUT /{source_id}/text
# ---------------------------------------------------------------------------

@router.put("/{source_id}/text", response_model=SourceRead)
async def attach_text(
    source_id: uuid.UUID,
    payload: AttachTextIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)
    _ensure_type(source, SourceType.TEXT)

    source.text_content = payload.text
    source.status       = SourceStatus.PENDING

    db.commit()
    db.refresh(source)
    return source


# ---------------------------------------------------------------------------
# PUT /{source_id}/link
# ---------------------------------------------------------------------------

@router.put("/{source_id}/link", response_model=SourceRead)
async def attach_link(
    source_id: uuid.UUID,
    payload: AttachLinkIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_owned_source_or_404(db, source_id, current_user)
    _ensure_type(source, SourceType.URL)

    source.url    = str(payload.url)
    source.status = SourceStatus.PENDING

    db.commit()
    db.refresh(source)
    return source