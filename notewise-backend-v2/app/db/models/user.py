from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.db.db import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    oid = Column(String(64), unique=True, nullable=False, index=True)  # Azure AD Object ID
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)