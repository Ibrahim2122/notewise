"""
GET /sources/{sid}/deepdive

Returns a short-lived SAS read URL for the DEEPDIVE artifact blob.
The frontend fetches the URL, then GETs the text directly from Azure Blob.

Security: ownership is enforced via Source → Workspace → user_id check.
"""
from datetime import datetime, timedelta, timezone

from azure.storage.blob import (
    BlobSasPermissions,
    BlobServiceClient,
    generate_blob_sas,
)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.db import get_db
from app.db.models.artifact import Artifact
from app.db.models.source import Source
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.dependencies.auth import get_current_user

router = APIRouter()


class DeepdiveUrlResponse(BaseModel):
    read_url: str
    artifact_id: str


@router.get("/sources/{sid}/deepdive", response_model=DeepdiveUrlResponse)
async def get_deepdive_url(
    sid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ------------------------------------------------------------------
    # Ownership check: source → workspace → user_id
    # ------------------------------------------------------------------
    source = (
        db.query(Source)
        .join(Workspace, Workspace.id == Source.workspace_id)
        .filter(Source.id == sid, Workspace.user_id == str(current_user.id))
        .first()
    )
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # ------------------------------------------------------------------
    # Find the DEEPDIVE artifact for this source
    # ------------------------------------------------------------------
    artifact = (
        db.query(Artifact)
        .filter_by(source_id=sid, artifact_type="DEEPDIVE")
        .order_by(Artifact.created_at.desc())
        .first()
    )
    if not artifact:
        raise HTTPException(
            status_code=404,
            detail="Deep dive not available yet — source may still be processing",
        )
    if not artifact.blob_uri:
        raise HTTPException(
            status_code=500,
            detail="Deep dive artifact has no blob URI — data integrity issue",
        )

    # ------------------------------------------------------------------
    # Generate a short-lived SAS read URL (15 minutes)
    # ------------------------------------------------------------------
    service_client = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )
    account_name = service_client.account_name
    account_key = service_client.credential.account_key
    container_name = settings.azure_blob_container
    blob_path = artifact.blob_uri

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container_name,
        blob_name=blob_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=15),
    )

    read_url = (
        f"https://{account_name}.blob.core.windows.net"
        f"/{container_name}/{blob_path}?{sas_token}"
    )

    return DeepdiveUrlResponse(
        read_url=read_url,
        artifact_id=str(artifact.id),
    )