"""
app/routes/sources_attach.py

Content-attachment endpoints for Sources.

Binary sources (PDF / AUDIO) — two-step SAS flow:
  POST /{source_id}/upload-url      → returns Azure Blob SAS URL (write-only, short TTL)
  POST /{source_id}/upload-complete → records blob path + marks PENDING

Polling:
  GET  /{source_id}                 → returns status + latest_summary when done

Text / URL (unchanged):
  PUT  /{source_id}/text
  PUT  /{source_id}/link

The caller must send  X-User-Id: <uuid>  on every request.  This is used to
build the canonical blob path so storage layout is correct from day one.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.db import get_db
from app.db.models.artifact import Artifact
from app.db.models.source import Source, SourceType, SourceStatus
from app.dependencies.user import get_user_id
from app.schemas.source import SourceRead
# from app.schemas.source_attach import AttachTextIn, AttachLinkIn
from app.schemas.source_upload import (
    UploadUrlResponse,
    UploadCompleteIn,
    UploadCompleteResponse,
    SourceStatusResponse,
)
from app.storage.azure_blob import ensure_container, generate_upload_sas_url
from app.storage.paths import source_blob_path

router = APIRouter(prefix="/sources", tags=["sources"])

BINARY_SOURCE_TYPES = {SourceType.PDF, SourceType.AUDIO}

_DEFAULT_EXT = {
    SourceType.PDF:   "pdf",
    SourceType.AUDIO: "audio",
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _get_source_or_404(db: Session, source_id: uuid.UUID) -> Source:
    src = db.query(Source).filter(Source.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    return src


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
            detail=(
                f"Endpoint only valid for binary source types: "
                f"{[t.value for t in BINARY_SOURCE_TYPES]}"
            ),
        )


def _canonical_blob_path(source: Source, user_id: uuid.UUID) -> str:
    """Build the deterministic blob path for this source using the real user_id."""
    ext = _DEFAULT_EXT.get(source.source_type, "bin")
    return source_blob_path(
        user_id=str(user_id),
        workspace_id=source.workspace_id,
        source_id=source.id,
        ext=ext,
    )


# ---------------------------------------------------------------------------
# GET /{source_id}  —  lightweight polling endpoint
# ---------------------------------------------------------------------------

@router.get("/{source_id}", response_model=SourceStatusResponse)
def get_source_status(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_user_id),
):
    """
    Returns the current status of a source.
    When status == 'done', also returns the content of the latest SUMMARY artifact.
    Frontend polls this every N seconds after upload-complete.
    """
    source = _get_source_or_404(db, source_id)

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
        source_id=source.id,
        status=source.status.value,
        latest_summary=latest_summary,
    )


# ---------------------------------------------------------------------------
# Step 1 — Request a write-only SAS upload URL
# ---------------------------------------------------------------------------

@router.post("/{source_id}/upload-url", response_model=UploadUrlResponse)
def request_upload_url(
    source_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_user_id),
):
    """
    Returns a short-lived Azure Blob SAS URL the frontend uses to PUT the file
    directly to Blob Storage.  The backend never receives the file bytes.
    """
    source = _get_source_or_404(db, source_id)
    _ensure_binary_type(source)

    blob_path = _canonical_blob_path(source, user_id)

    ensure_container(settings.AZURE_BLOB_CONTAINER)
    upload_url, expires_in_seconds = generate_upload_sas_url(blob_path)

    return UploadUrlResponse(
        source_id=source.id,
        blob_path=blob_path,
        upload_url=upload_url,
        expires_in_seconds=expires_in_seconds,
    )


# ---------------------------------------------------------------------------
# Step 2 — Finalize after the frontend's direct upload to Blob
# ---------------------------------------------------------------------------

@router.post("/{source_id}/upload-complete", response_model=UploadCompleteResponse)
def finalize_upload(
    source_id: uuid.UUID,
    payload: UploadCompleteIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_user_id),
):
    """
    Called by the frontend after it has successfully PUT the file to Azure Blob.
    Validates the blob_path server-side, saves metadata, marks source PENDING.
    """
    source = _get_source_or_404(db, source_id)
    _ensure_binary_type(source)

    # Security: re-derive expected path and compare — client can't forge a path
    expected = _canonical_blob_path(source, user_id)
    if payload.blob_path != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"blob_path does not match expected path. Expected: {expected}",
        )

    source.storage_uri       = payload.blob_path
    source.mime_type         = payload.mime_type
    source.original_filename = payload.original_filename
    source.status            = SourceStatus.PENDING

    db.commit()
    db.refresh(source)

    return UploadCompleteResponse(
        source_id=source.id,
        storage_uri=source.storage_uri,
        status=source.status.value,
    )


# ---------------------------------------------------------------------------
# Text attachment
# ---------------------------------------------------------------------------

@router.put("/{source_id}/text", response_model=SourceRead)
def attach_text(
    source_id: uuid.UUID,
    payload: AttachTextIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_user_id),
):
    source = _get_source_or_404(db, source_id)
    _ensure_type(source, SourceType.TEXT)

    source.text_content = payload.text
    source.status       = SourceStatus.PENDING

    db.commit()
    db.refresh(source)
    return source


# ---------------------------------------------------------------------------
# URL / link attachment
# ---------------------------------------------------------------------------

@router.put("/{source_id}/link", response_model=SourceRead)
def attach_link(
    source_id: uuid.UUID,
    payload: AttachLinkIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_user_id),
):
    source = _get_source_or_404(db, source_id)
    _ensure_type(source, SourceType.URL)

    source.url    = str(payload.url)
    source.status = SourceStatus.PENDING

    db.commit()
    db.refresh(source)
    return source