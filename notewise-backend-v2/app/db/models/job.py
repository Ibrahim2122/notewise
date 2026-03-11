from sqlalchemy import Column, String, DateTime, Enum as SqlEnum, func, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from enum import Enum
import uuid
from app.db.db import Base

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"

class JobType(str, Enum):
    INGEST = "ingest"

class Job(Base):
    __tablename__ = "jobs"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        nullable=False)
    
    source_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False)
    source = relationship("Source", back_populates="jobs")
    
    job_type = Column(
        SqlEnum(JobType, name ="job_type_enum"), 
        nullable=False,
        default=JobType.INGEST    
    )

    status = Column(
        SqlEnum(JobStatus, name="job_status_enum"), 
        nullable=False, 
        default=JobStatus.PENDING
        )
    
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )