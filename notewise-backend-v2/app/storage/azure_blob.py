"""
app/storage/azure_blob.py

Helpers for Azure Blob Storage:
  - Ensure a container exists (idempotent)
  - Generate a short-lived, write-only SAS URL for a single blob path
"""

from datetime import datetime, timezone, timedelta

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
    generate_blob_sas,
)

from app.config import settings


# ---------------------------------------------------------------------------
# Internal client factory (module-level singleton is fine for sync FastAPI)
# ---------------------------------------------------------------------------

def _blob_service_client() -> BlobServiceClient:
    account_url = f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
    return BlobServiceClient(
        account_url=account_url,
        credential=settings.AZURE_STORAGE_ACCOUNT_KEY,
    )


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def ensure_container(container_name: str) -> None:
    """Create the container if it does not already exist. Safe to call every request."""
    client = _blob_service_client()
    try:
        client.create_container(container_name)
    except ResourceExistsError:
        pass  # Already there — this is the happy path in production


def generate_upload_sas_url(blob_path: str) -> tuple[str, int]:
    """
    Generate a write-only SAS URL for *blob_path* inside the configured container.

    Returns:
        (upload_url, expires_in_seconds)
    """
    ttl_minutes = settings.AZURE_SAS_TTL_MINUTES
    expiry = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)

    sas_token = generate_blob_sas(
        account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
        container_name=settings.AZURE_BLOB_CONTAINER,
        blob_name=blob_path,
        account_key=settings.AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(create=True, write=True),  # write-only
        expiry=expiry,
    )

    upload_url = (
        f"https://{settings.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net"
        f"/{settings.AZURE_BLOB_CONTAINER}/{blob_path}?{sas_token}"
    )

    return upload_url, ttl_minutes * 60
