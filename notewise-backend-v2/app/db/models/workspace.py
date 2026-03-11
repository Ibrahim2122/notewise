"""
app/db/models/workspace.py
"""

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.db import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    # Owner — stored as string so it's auth-system agnostic.
    # Currently populated from X-User-Id header; swap to JWT sub later.
    user_id = Column(String, nullable=False, index=True)

    name        = Column(String, nullable=False)
    description = Column(Text,   nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sources = relationship(
        "Source",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    artifacts = relationship(
        "Artifact",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )