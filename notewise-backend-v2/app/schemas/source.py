from typing import Optional
from pydantic import BaseModel
from app.db.models.source import SourceStatus, SourceType
from datetime import datetime
import uuid


class SourceCreate(BaseModel):
    source_type: SourceType
    title: str
    storage_uri: Optional[str] = None

class SourceRead(BaseModel):
    id: uuid.UUID
    source_type: SourceType
    workspace_id: uuid.UUID
    title: str
    status: SourceStatus
    created_at: datetime

    storage_uri: Optional[str] = None
    text_content: Optional[str] = None  
    url: Optional[str] = None        
    mime_type: Optional[str] = None  
    original_filename: Optional[str] = None  

    class Config:
        from_attributes = True