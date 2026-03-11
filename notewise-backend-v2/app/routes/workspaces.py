"""
routes/workspaces.py

POST /workspaces             — create
GET  /workspaces/{id}        — detail (includes latest_summary + latest_deepdive)
DELETE /workspaces/{id}      — delete
POST /workspaces/{id}/deepdive — trigger / re-trigger deepdive generation
"""
import uuid
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.db import get_db
from app.db.models.artifact import Artifact
from app.db.models.source import Source
from app.db.models.user import User
from app.db.models.workspace import Workspace
from app.dependencies.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("notewise")


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SourceOut(BaseModel):
    id: str
    workspace_id: str
    source_type: str
    title: str
    status: str
    storage_uri: str | None
    text_content: str | None
    url: str | None
    mime_type: str | None
    original_filename: str | None
    created_at: str
    latest_summary: str | None

    class Config:
        from_attributes = True


class WorkspaceDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: str
    sources: list[SourceOut]
    latest_summary: str | None
    latest_deepdive: str | None


class DeepDiveJobResponse(BaseModel):
    id: str
    status: str
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_workspace_or_404(wid: str, current_user: User, db: Session) -> Workspace:
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == wid, Workspace.user_id == str(current_user.id))
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _latest_artifact(db: Session, workspace_id: str, artifact_type: str) -> str | None:
    artifact = (
        db.query(Artifact)
        .filter_by(workspace_id=workspace_id, artifact_type=artifact_type)
        .order_by(Artifact.created_at.desc())
        .first()
    )
    return artifact.content if artifact else None


def _build_detail(workspace: Workspace, db: Session) -> WorkspaceDetailResponse:
    sources_out = []
    for s in workspace.sources:
        src_summary = (
            db.query(Artifact)
            .filter_by(source_id=s.id, artifact_type="SUMMARY")
            .order_by(Artifact.created_at.desc())
            .first()
        )
        sources_out.append(
            SourceOut(
                id=str(s.id),
                workspace_id=str(s.workspace_id),
                source_type=s.source_type,
                title=s.title,
                status=s.status,
                storage_uri=s.storage_uri,
                text_content=s.text_content,
                url=s.url,
                mime_type=s.mime_type,
                original_filename=s.original_filename,
                created_at=s.created_at.isoformat(),
                latest_summary=src_summary.content if src_summary else None,
            )
        )

    return WorkspaceDetailResponse(
        id=str(workspace.id),
        name=workspace.name,
        description=workspace.description,
        created_at=workspace.created_at.isoformat(),
        sources=sources_out,
        latest_summary=_latest_artifact(db, str(workspace.id), "SUMMARY"),
        latest_deepdive=_latest_artifact(db, str(workspace.id), "DEEPDIVE"),
    )


# ---------------------------------------------------------------------------
# Gemini / OpenRouter deepdive generation (background task)
# ---------------------------------------------------------------------------

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_GEMINI_MODEL = "google/gemini-2.0-flash-001"


def _call_gemini(prompt: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY or GEMINI_API_KEY is not set")

    payload = json.dumps({
        "model": _GEMINI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }).encode("utf-8")

    req = urllib.request.Request(
        _OPENROUTER_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected Gemini response shape: {str(body)[:300]}") from exc


def _generate_deepdive_bg(workspace_id: str, db_url: str) -> None:
    """Background task: regenerate DEEPDIVE artifact for a workspace."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db: Session = SessionLocal()

    try:
        sources = (
            db.query(Source)
            .filter_by(workspace_id=workspace_id, status="done")
            .all()
        )

        combined_text = "\n\n---\n\n".join(
            s.text_content for s in sources if s.text_content
        )
        if not combined_text:
            logger.warning("No text content found for workspace %s — skipping deepdive", workspace_id)
            return

        prompt = f"""You are a senior educator and technical writer.

Create a deep-dive explanation of the document as TSX (React) code so it can be rendered in a UI.

Output rules (VERY IMPORTANT):
- Return ONLY TSX code. No markdown fences. No explanations. No backticks.
- The output must be a single exported React component:
  export default function DeepDive() {{ return ( ... ); }}
- Use semantic HTML inside TSX: <section>, <h2>, <h3>, <p>, <ul>, <li>, <code>, <pre>.
- Keep it well-structured and readable.
- Do NOT import anything.
- Do NOT reference external assets.
- Escape any braces in text content properly for TSX.

Content requirements:
- Start with a brief overview section.
- Break down the main concepts into sections.
- Include at least 1 concrete example section.
- End with a "Key Takeaways" section.

DOCUMENT TEXT:
{combined_text}

Return ONLY the TSX component code now."""

        deepdive_content = _call_gemini(prompt)

        now = datetime.now(timezone.utc)

        db.query(Artifact).filter_by(
            workspace_id=workspace_id, artifact_type="DEEPDIVE"
        ).delete()

        db.add(
            Artifact(
                id=uuid.uuid4(),
                source_id=sources[0].id,
                workspace_id=workspace_id,
                artifact_type="DEEPDIVE",
                content=deepdive_content,
                created_at=now,
            )
        )
        db.commit()
        logger.info("DEEPDIVE artifact regenerated for workspace %s", workspace_id)

    except Exception as exc:
        db.rollback()
        logger.error("DEEPDIVE generation failed for workspace %s: %s", workspace_id, exc, exc_info=True)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/workspaces")
async def create_workspace(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = Workspace(
        id=uuid.uuid4(),
        user_id=str(current_user.id),
        name=name,
        created_at=datetime.now(timezone.utc),
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return _build_detail(workspace, db)


@router.get("/workspaces/{wid}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    wid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = _get_workspace_or_404(wid, current_user, db)
    return _build_detail(workspace, db)


@router.delete("/workspaces/{wid}", status_code=204)
async def delete_workspace(
    wid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = _get_workspace_or_404(wid, current_user, db)
    db.delete(workspace)
    db.commit()


@router.post("/workspaces/{wid}/deepdive", response_model=DeepDiveJobResponse)
async def trigger_deepdive(
    wid: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = _get_workspace_or_404(wid, current_user, db)

    done_sources = (
        db.query(Source).filter_by(workspace_id=str(workspace.id), status="done").count()
    )
    if done_sources == 0:
        raise HTTPException(
            status_code=422,
            detail="No processed sources available — upload and process a source first",
        )

    db_url = os.environ["DATABASE_URL"]
    background_tasks.add_task(_generate_deepdive_bg, str(workspace.id), db_url)

    return DeepDiveJobResponse(
        id=f"deepdive-{workspace.id}",
        status="pending",
        created_at=datetime.now(timezone.utc).isoformat(),
    )