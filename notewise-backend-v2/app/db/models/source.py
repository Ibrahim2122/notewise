from sqlalchemy import Column, String, DateTime, Enum as SqlEnum, func, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum
import uuid
from app.db.db import Base

class SourceStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"

class SourceType(str, Enum):
    PDF = "pdf"
    AUDIO = "audio"
    # VIDEO = "video"
    TEXT = "text"
    URL = "url"

class Source(Base):
    __tablename__ = "sources"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        nullable=False)
    
    workspace_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False)
    workspace = relationship("Workspace", back_populates="sources")
    
    source_type = Column(
        SqlEnum(SourceType, name ="source_type_enum"), 
        nullable=False
    )

    title = Column(String, nullable=False)

    storage_uri = Column(String, nullable=True)

    text_content = Column(Text, nullable=True)

    url = Column(String, nullable=True)

    mime_type = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)

    status = Column(
        SqlEnum(SourceStatus, name="source_status_enum"), 
        nullable=False, 
        default=SourceStatus.PENDING
        )
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    jobs = relationship(
        "Job",
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    artifacts = relationship(
        "Artifact",
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True
    )