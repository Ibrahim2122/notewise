from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

from app.db.models.source import SourceType, SourceStatus


class WorkspaceDetailWorkspace(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime


class WorkspaceDetailSource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    source_type: SourceType
    status: SourceStatus
    created_at: datetime


class WorkspaceDetailArtifact(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    artifact_type: str
    content: Optional[str] = None
    created_at: datetime


class WorkspaceDetailResponse(BaseModel):
    workspace: WorkspaceDetailWorkspace
    sources: List[WorkspaceDetailSource]
    latest_summary: Optional[WorkspaceDetailArtifact] = None