"""
app/routes/dashboard.py
"""

from sqlalchemy import select, func, case, literal
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.db.db import get_db
from app.db.models.workspace import Workspace
from app.db.models.source import Source, SourceStatus
from app.db.models.user import User
from app.dependencies.auth import get_current_user
from app.schemas.workspaceCard import WorkspaceCard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=list[WorkspaceCard])
async def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_active = func.coalesce(
        func.bool_or(Source.status.in_([SourceStatus.PENDING, SourceStatus.PROCESSING])),
        False,
    )

    status_expr = case(
        (is_active, literal("active")),
        else_=literal("idle"),
    ).label("status")

    source_count_expr = func.count(Source.id).label("source_count")

    last_updated_expr = func.coalesce(
        func.max(Source.created_at),
        Workspace.created_at,
    ).label("last_updated")

    stmt = (
        select(
            Workspace.id,
            Workspace.name,
            Workspace.description,
            status_expr,
            source_count_expr,
            last_updated_expr,
        )
        .where(Workspace.user_id == str(current_user.id))
        .outerjoin(Source, Source.workspace_id == Workspace.id)
        .group_by(Workspace.id, Workspace.name, Workspace.description, Workspace.created_at)
        .order_by(last_updated_expr.desc())
    )

    rows = db.execute(stmt).mappings().all()
    return [WorkspaceCard.model_validate(r) for r in rows]