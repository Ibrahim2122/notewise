from sqlalchemy import Column, String, DateTime, Enum as SqlEnum, func, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum
import uuid
from app.db.db import Base

class ArtifactType(str, Enum):
    SUMMARY = "SUMMARY"
    DEEPDIVE = "DEEPDIVE"


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        nullable=False)
    
    workspace_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False)
    workspace = relationship("Workspace", back_populates="artifacts")

    source_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=True)
    source = relationship("Source", back_populates="artifacts")

    artifact_type = Column(String, nullable=False, default="SUMMARY")

    content = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    blob_uri = Column(String, nullable=True)         # Blob path — used for DEEPDIVE