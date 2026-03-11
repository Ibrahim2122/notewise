"""
function_app.py  —  Azure Function: BlobCreated trigger for notewise-dev container

Pipeline:
  1. Blob created at  users/<user_id>/workspaces/<workspace_id>/sources/<source_id>.<ext>
  2. Parse source_id from the blob name
  3. Find matching Source + INGEST Job in DB
  4. Mark Source + Job → PROCESSING
  5. Extract text (PDF via pypdf; AUDIO placeholder)
  6. Call Gemini to generate a structured summary
  7. Write Artifact row (type=SUMMARY) with Gemini output
  8. Mark Source + Job → DONE  (or FAILED with error_message on any exception)

Environment variables (local.settings.json + Azure Function App Settings):
  DATABASE_URL                    — postgresql://user:pass@host:5432/dbname
  AZURE_STORAGE_CONNECTION_STRING — full connection string
  AZURE_BLOB_CONTAINER            — e.g. "notewise-dev"
  GEMINI_API_KEY                  — Google AI Studio key (never hardcode) - Back Agaain
  GEMENI_API_KEY                    — GEMENI API key (never hardcode) - Removed

"""

import json
import logging
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from enum import Enum

import urllib.request
import urllib.error

import azure.functions as func
from azure.storage.blob import BlobServiceClient
from sqlalchemy import Column, DateTime, Enum as SqlEnum, String, Text, create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logger = logging.getLogger("notewise")
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Inline ORM models  (no dependency on FastAPI app package)
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class SourceStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    DONE       = "done"
    FAILED     = "failed"


class SourceType(str, Enum):
    PDF   = "pdf"
    AUDIO = "audio"
    TEXT  = "text"
    URL   = "url"


class JobStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    DONE       = "done"
    FAILED     = "failed"


class JobType(str, Enum):
    INGEST = "ingest"


class Source(Base):
    __tablename__ = "sources"

    # No ForeignKey() declarations — the Function never traverses relationships
    # and FK resolution in ORM metadata requires all referenced tables to be
    # present in the same Base, which we deliberately avoid here.
    id           = Column(PG_UUID(as_uuid=True), primary_key=True)
    workspace_id = Column(PG_UUID(as_uuid=True), nullable=False)
    source_type  = Column(SqlEnum(SourceType,   name="source_type_enum"),   nullable=False)
    status       = Column(SqlEnum(SourceStatus, name="source_status_enum"), nullable=False)
    storage_uri  = Column(String, nullable=True)
    title        = Column(String, nullable=False)
    created_at   = Column(DateTime(timezone=True), nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id            = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id     = Column(PG_UUID(as_uuid=True), nullable=False)
    job_type      = Column(SqlEnum(JobType,   name="job_type_enum"),   nullable=False)
    status        = Column(SqlEnum(JobStatus, name="job_status_enum"), nullable=False)
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class Artifact(Base):
    __tablename__ = "artifacts"

    id            = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id     = Column(PG_UUID(as_uuid=True), nullable=False)
    workspace_id  = Column(PG_UUID(as_uuid=True), nullable=False)
    artifact_type = Column(String, nullable=False)
    content       = Column(Text,   nullable=True)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# DB session factory  (built once on cold start)
# ---------------------------------------------------------------------------

def _make_session_factory() -> sessionmaker:
    db_url = os.environ["DATABASE_URL"]
    engine = create_engine(db_url, pool_pre_ping=True, pool_size=2, max_overflow=0)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


_SessionFactory = _make_session_factory()


@contextmanager
def get_db():
    db: Session = _SessionFactory()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Blob path parser
# ---------------------------------------------------------------------------

_BLOB_PATH_RE = re.compile(
    r"users/[^/]+/workspaces/[^/]+/sources/"
    r"(?P<source_id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
    r"\.(?P<ext>[a-z0-9]+)$",
    re.IGNORECASE,
)


def parse_blob_name(blob_name: str) -> tuple[uuid.UUID, str]:
    m = _BLOB_PATH_RE.search(blob_name)
    if not m:
        raise ValueError(f"Blob name does not match expected pattern: {blob_name!r}")
    return uuid.UUID(m.group("source_id")), m.group("ext").lower()


# ---------------------------------------------------------------------------
# Blob download
# ---------------------------------------------------------------------------

def _download_blob_bytes(blob_name: str) -> bytes:
    conn_str  = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
    container = os.environ["AZURE_BLOB_CONTAINER"]
    client    = BlobServiceClient.from_connection_string(conn_str)
    return client.get_blob_client(container=container, blob=blob_name).download_blob().readall()


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def _extract_pdf_text(blob_bytes: bytes) -> str:
    import io
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(blob_bytes))
    pages  = [page.extract_text() or "" for page in reader.pages]
    text   = "\n\n".join(p.strip() for p in pages if p.strip())
    return text or "[No readable text found in PDF]"


# ---------------------------------------------------------------------------
# GEMINI (via OpenRouter) helpers
# ---------------------------------------------------------------------------

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_OPENROUTER_TIMEOUT = 60  # seconds

# Pick any OpenRouter-supported model you want
_GEMINI_MODEL = "google/gemini-2.0-flash-001"

# Optional but recommended by OpenRouter
_APP_REFERER = os.environ.get("OPENROUTER_HTTP_REFERER", "https://example.com")
_APP_TITLE = os.environ.get("OPENROUTER_APP_TITLE", "notewise-functions")


class GeminiError(Exception):
    """Raised when the Gemini/OpenRouter API returns an error or an unexpected response."""


def _call_gemini(prompt: str) -> str:
    """
    POST a prompt to OpenRouter (Gemini model) and return the text response.
    Raises GeminiError on any API-level failure so the caller can mark the job FAILED.
    Uses only stdlib urllib — no extra dependencies.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("OPENROUTER_API_KEY (or GEMINI_API_KEY) environment variable is not set")

    payload = json.dumps({
        "model": _GEMINI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }).encode("utf-8")

    req = urllib.request.Request(
        _OPENROUTER_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "notewise-functions/1.0",
            # OpenRouter recommended:
            "HTTP-Referer": _APP_REFERER,
            "X-Title": _APP_TITLE,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=_OPENROUTER_TIMEOUT) as resp:
            body_bytes = resp.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        # Try to parse OpenRouter JSON error shape if possible
        try:
            err_obj = json.loads(raw)
            msg = err_obj.get("error", {}).get("message") or raw
        except Exception:
            msg = raw
        raise GeminiError(f"OpenRouter HTTP {exc.code}: {msg[:500]}") from exc
    except urllib.error.URLError as exc:
        raise GeminiError(f"OpenRouter network error: {exc.reason}") from exc

    try:
        body = json.loads(body_bytes.decode("utf-8"))
    except Exception as exc:
        raise GeminiError(f"Failed to parse JSON response: {body_bytes[:200]!r}") from exc

    # Parse OpenAI-compatible response envelope
    try:
        text = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError(f"Unexpected response shape: {str(body)[:500]}") from exc

    if not isinstance(text, str) or not text.strip():
        raise GeminiError("Model returned an empty response")

    return text.strip()


def summarize_structured(extracted_text: str) -> str:
    """
    Short summary: 4–5 sentences, returned as a single <p>...</p>.
    """
    prompt = f"""You are a clear and concise summarizer.

Write a short and easy-to-understand summary of the document.

Rules:
- The summary must be exactly 4–5 sentences.
- Return ONLY plain text.
- Do NOT use HTML, headings, bullet points, or lists.
- Write everything as a single paragraph.
- Use simple language that is easy to understand.
- Preserve the important ideas and meaning of the document.

Focus on:
- The main purpose of the document
- The most important ideas
- The overall conclusion or implication

DOCUMENT TEXT:
{extracted_text}

Return ONLY the summary paragraph and nothing else."""
    return _call_gemini(prompt)


def explain_in_depth(extracted_text: str) -> str:
    """
    Deep dive: return TSX (React) code only.
    """
    prompt = f"""You are a senior educator and technical writer.

Explain the document clearly and thoroughly in a documentation-style format using TSX (React).

Output rules (VERY IMPORTANT):
- Return ONLY valid TSX code.
- No markdown fences, no explanations, no backticks.
- The output must be a single exported React component:
  export default function DeepDive() {{ return ( ... ); }}
- Use semantic HTML elements inside TSX: <section>, <h2>, <h3>, <p>, <ul>, <li>, <code>, <pre>.
- Do NOT import anything.
- Do NOT reference external assets.
- Ensure the code is clean, readable, and valid TSX.

Content style:
- Write explanations that are simple, clear, and easy to understand.
- Keep the original meaning and important ideas of the document.
- Organize the explanation like technical documentation.

Structure requirements:
1. Overview section explaining the topic.
2. Sections that explain the main concepts from the document.
3. At least one example section that demonstrates the ideas.
4. A final "Key Takeaways" section summarizing the most important points.

DOCUMENT TEXT:
{extracted_text}

Return ONLY the TSX component code."""
    raw = _call_gemini(prompt)
    # Strip markdown code fences if the model wrapped the output despite instructions
    raw = re.sub(r'^```(?:tsx|jsx|typescript|javascript)?\s*', '', raw, flags=re.IGNORECASE).strip()
    raw = re.sub(r'\s*```\s*$', '', raw).strip()
    return raw

# ---------------------------------------------------------------------------
# Processing pipeline
# ---------------------------------------------------------------------------

def _process_source(source_type: str, blob_name: str) -> tuple[str, str | None]:
    """
    Run the full pipeline for a source.

    Returns:
        (summary_content, deepdive_content | None)

    Raises:
        GeminiError   — if Gemini/OpenRouter fails (caller marks job FAILED)
        ValueError    — if source type is unsupported
        Any other exc — propagated as-is
    """
    if source_type == SourceType.PDF:
        blob_bytes = _download_blob_bytes(blob_name)
        extracted_text = _extract_pdf_text(blob_bytes)

        logger.info("Extracted %d chars of text, calling Gemini via OpenRouter…", len(extracted_text))

        summary = summarize_structured(extracted_text)
        deepdive = explain_in_depth(extracted_text)

        return summary, deepdive

    if source_type == SourceType.AUDIO:
        raise NotImplementedError(
            "AUDIO processing is not yet implemented. "
            "Wire up Whisper or Azure Speech before re-queuing."
        )

    raise ValueError(f"Unsupported source type for processing: {source_type!r}")


# ---------------------------------------------------------------------------
# Azure Function entry point
# ---------------------------------------------------------------------------

app = func.FunctionApp()

CONTAINER = os.environ.get("AZURE_BLOB_CONTAINER", "notewise-dev")


@app.blob_trigger(
    arg_name="blob",
    path=f"{CONTAINER}/{{name}}",
    connection="AZURE_STORAGE_CONNECTION_STRING",
)
def process_blob(blob: func.InputStream) -> None:
    blob_name: str = blob.name

    # Azure passes "<container>/<blob_path>" — strip the container prefix
    prefix = f"{CONTAINER}/"
    if blob_name.startswith(prefix):
        blob_name = blob_name[len(prefix):]

    logger.info("BlobCreated trigger fired for: %s", blob_name)

    try:
        source_id, ext = parse_blob_name(blob_name)
    except ValueError as e:
        logger.warning("Skipping blob — %s", e)
        return

    with get_db() as db:
        source: Source | None = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            logger.error("Source %s not found in DB — aborting", source_id)
            return

        job: Job | None = (
            db.query(Job)
            .filter(Job.source_id == source_id, Job.job_type == JobType.INGEST)
            .order_by(Job.created_at.desc())
            .first()
        )

        # Mark PROCESSING
        source.status = SourceStatus.PROCESSING
        if job:
            job.status = JobStatus.PROCESSING
        db.commit()
        logger.info("Source %s → PROCESSING", source_id)

        try:
            summary_content, deepdive_content = _process_source(source.source_type, blob_name)

            now = datetime.now(timezone.utc)

            # Write SUMMARY artifact (drives latest_summary in GET /workspaces/{id})
            db.add(Artifact(
                id=uuid.uuid4(),
                source_id=source.id,
                workspace_id=source.workspace_id,
                artifact_type="SUMMARY",
                content=summary_content,
                created_at=now,
            ))

            # Write DEEPDIVE artifact if Gemini produced one
            if deepdive_content:
                db.add(Artifact(
                    id=uuid.uuid4(),
                    source_id=source.id,
                    workspace_id=source.workspace_id,
                    artifact_type="DEEPDIVE",
                    content=deepdive_content,
                    created_at=now,
                ))

            source.status = SourceStatus.DONE
            if job:
                job.status = JobStatus.DONE

            db.commit()
            logger.info("Source %s → DONE (summary + deepdive written)", source_id)

        except Exception as exc:
            db.rollback()
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.exception("Processing failed for source %s: %s", source_id, error_msg)

            source.status = SourceStatus.FAILED
            if job:
                job.status        = JobStatus.FAILED
                job.error_message = error_msg[:1000]  # guard against oversized messages
            db.commit()