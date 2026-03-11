"""
app/schemas/source_upload.py

Schemas for the two-step SAS direct-upload flow (PDF / AUDIO)
and the lightweight polling endpoint.
"""

import uuid
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# POST /sources/{source_id}/upload-url
# ---------------------------------------------------------------------------

class UploadUrlResponse(BaseModel):
    id: uuid.UUID
    blob_path: str
    upload_url: str
    expires_in_seconds: int


# ---------------------------------------------------------------------------
# POST /sources/{source_id}/upload-complete
# ---------------------------------------------------------------------------

class UploadCompleteIn(BaseModel):
    blob_path: str
    mime_type: str
    original_filename: str


class UploadCompleteResponse(BaseModel):
    id: uuid.UUID
    storage_uri: str
    status: str  # always "pending" after this call


# ---------------------------------------------------------------------------
# GET /sources/{source_id}  —  lightweight polling endpoint
# ---------------------------------------------------------------------------

class SourceStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    # Populated only when status == "done" and a SUMMARY artifact exists
    latest_summary: str | None = None