from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

class WorkspaceCardStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "idle"

class WorkspaceCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None

    status: WorkspaceCardStatus

    sourceCount: int = Field(..., alias="source_count")
    lastUpdated: datetime = Field(..., alias="last_updated")