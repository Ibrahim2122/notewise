"""
app/routes/sources.py
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.db import get_db
from app.db.models.job import Job, JobStatus, JobType
from app.db.models.source import Source, SourceStatus
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.dependencies.auth import get_current_user
from app.schemas.source import SourceCreate, SourceRead

router = APIRouter(prefix="/workspaces/{workspace_id}/sources", tags=["sources"])


def _get_owned_workspace_or_404(
    db: Session,
    workspace_id: uuid.UUID,
    current_user: User,
) -> Workspace:
    workspace = db.execute(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == str(current_user.id),
        )
    ).scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.post("", response_model=SourceRead, status_code=status.HTTP_201_CREATED)
async def create_source(
    workspace_id: uuid.UUID,
    source_data: SourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_workspace_or_404(db, workspace_id, current_user)

    try:
        new_source = Source(
            workspace_id=workspace_id,
            source_type=source_data.source_type,
            title=source_data.title,
            status=SourceStatus.PENDING,
        )
        db.add(new_source)
        db.flush()

        job = Job(
            source_id=new_source.id,
            job_type=JobType.INGEST,
            status=JobStatus.PENDING,
        )
        db.add(job)

        db.commit()
        db.refresh(new_source)
        return new_source

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list[SourceRead])
async def list_sources(
    workspace_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_owned_workspace_or_404(db, workspace_id, current_user)

    sources = (
        db.query(Source)
        .filter(Source.workspace_id == workspace_id)
        .order_by(Source.created_at.desc())
        .all()
    )
    return sources