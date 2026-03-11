# NoteWise

**NoteWise** is an AI-powered study tool that transforms your documents, notes, and audio recordings into structured study materials. Upload a source, and NoteWise automatically generates a concise summary and a long-form concept deep dive — all powered by Google Gemini.

---

## Features

- 📄 **Multi-source ingestion** — Upload PDFs, paste text, add links, or upload audio recordings
- 🤖 **AI-generated summaries** — Concise 4–5 sentence summaries generated automatically on upload
- 📖 **Concept Deep Dive** — Long-form, documentation-style explanations rendered as interactive React components
- 🗂️ **Workspaces** — Organise your sources by course, topic, or project
- 📊 **Live processing status** — Real-time status tracking for every source
- 🔄 **On-demand regeneration** — Regenerate deep dives at any time

---

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Next.js Frontend  │────▶│   FastAPI Backend     │────▶│   PostgreSQL DB     │
│   (TypeScript)      │◀────│   (Python)            │◀────│                     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                   ▼
         ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐
         │  Azure Blob     │  │   Azure      │  │  Google Gemini     │
         │  Storage        │  │   Functions  │  │  (via OpenRouter)  │
         └─────────────────┘  └──────────────┘  └────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Storage | Azure Blob Storage (private container, SAS upload) |
| Processing | Azure Functions (BlobCreated trigger, Python) |
| AI | Google Gemini 2.0 Flash via OpenRouter |
| Auth | Header-based (`X-User-Id`), UUID per email in localStorage |

---

## How It Works

### Source Upload Pipeline

```
User uploads file
      │
      ▼
Frontend: createSource → getUploadUrl → PUT to Azure Blob → completeUpload
      │
      ▼
Azure Function (BlobCreated trigger fires)
      │
      ├── Extract text (PDF via pypdf)
      ├── Call Gemini → SUMMARY artifact (plain text)
      └── Call Gemini → DEEPDIVE artifact (TSX component code)
      │
      ▼
Source marked DONE, artifacts saved to DB
```

### Deep Dive Rendering

The deep dive is stored as a raw TSX React component string in the database. On the frontend, it is rendered inside a sandboxed `<iframe>` using Babel Standalone and React loaded from CDN. This isolates the AI-generated code from the host application completely.

---

## Project Structure

```
├── frontend/                          # Next.js application
│   ├── app/
│   │   ├── dashboard/page.tsx         # Workspace listing
│   │   ├── workspace/[id]/
│   │   │   ├── page.tsx               # Workspace detail
│   │   │   └── deepdive/page.tsx      # Concept Deep Dive viewer
│   │   └── auth/page.tsx              # Login / Register
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── workspace-card.tsx
│   │   │   └── create-workspace-modal.tsx
│   │   └── workspace/
│   │       ├── source-upload-panel.tsx
│   │       ├── source-list.tsx
│   │       ├── summary-card.tsx
│   │       ├── asset-panel.tsx
│   │       ├── job-status-panel.tsx
│   │       ├── deep-dive-renderer.tsx
│   │       ├── markdown-render.tsx
│   │       └── workspace-breadcrumb.tsx
│   └── lib/
│       ├── api.ts                     # Real API client
│       └── auth-context.tsx           # Auth provider
│
├── backend/                           # FastAPI application
│   ├── app/
│   │   ├── main.py                    # App entry point, CORS
│   │   ├── config.py                  # Settings (env vars)
│   │   ├── db/
│   │   │   ├── db.py                  # SQLAlchemy session
│   │   │   └── models/
│   │   │       ├── workspace.py
│   │   │       ├── source.py
│   │   │       ├── job.py
│   │   │       └── artifact.py
│   │   ├── routes/
│   │   │   ├── workspaces.py          # Workspace CRUD + deepdive trigger
│   │   │   ├── sources_attach.py      # Source upload + attach endpoints
│   │   │   └── dashboard.py           # Dashboard summary endpoint
│   │   ├── schemas/
│   │   │   ├── source.py
│   │   │   └── source_upload.py
│   │   ├── dependencies/
│   │   │   └── user.py                # X-User-Id header dependency
│   │   └── storage/
│   │       ├── azure_blob.py          # SAS URL generation
│   │       └── paths.py               # Blob path builder
│   └── alembic/                       # DB migrations
│
└── function_app.py                    # Azure Function (blob trigger)
```

---

## Database Schema

```sql
workspaces  (id UUID PK, user_id VARCHAR, name, description, created_at)
sources     (id UUID PK, workspace_id FK, source_type, title, status,
             storage_uri, text_content, url, mime_type, original_filename, created_at)
jobs        (id UUID PK, source_id FK, job_type, status, error_message, created_at)
artifacts   (id UUID PK, source_id FK, workspace_id FK, artifact_type,
             content TEXT, created_at)
```

Artifact types:
- `SUMMARY` — Plain text paragraph, 4–5 sentences
- `DEEPDIVE` — TSX React component source code

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- Azure Storage account
- OpenRouter API key (for Gemini access)

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install

# Copy and fill in environment variables
cp .env.example .env.local

# Start the dev server
npm run dev
```

### Azure Function Setup

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

cd function
pip install -r requirements.txt

# Configure local.settings.json with your connection strings
func start
```

---

## Environment Variables

### Backend (`.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/notewise
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_BLOB_CONTAINER=notewise-dev
OPENROUTER_API_KEY=sk-or-...
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Azure Function (`local.settings.json`)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "DATABASE_URL": "postgresql://...",
    "AZURE_STORAGE_CONNECTION_STRING": "...",
    "AZURE_BLOB_CONTAINER": "notewise-dev",
    "OPENROUTER_API_KEY": "sk-or-..."
  }
}
```

---

## API Reference

### Workspaces

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | List all workspaces for the user |
| `POST` | `/workspaces` | Create a new workspace |
| `GET` | `/workspaces/{id}` | Get workspace with sources and latest artifacts |
| `DELETE` | `/workspaces/{id}` | Delete a workspace |
| `POST` | `/workspaces/{id}/deepdive` | Trigger deep dive regeneration |

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/workspaces/{id}/sources` | Create a source record |
| `POST` | `/sources/{id}/upload-url` | Get a SAS write URL for blob upload |
| `POST` | `/sources/{id}/upload-complete` | Finalise upload, mark source pending |
| `GET` | `/sources/{id}` | Poll source status |
| `PUT` | `/sources/{id}/text` | Attach plain text content |
| `PUT` | `/sources/{id}/link` | Attach a URL |
| `DELETE` | `/sources/{id}` | Delete a source |

All endpoints require the `X-User-Id: <uuid>` header.

---

## Authentication

NoteWise currently uses a simplified header-based auth suitable for development. Each email address is assigned a stable UUID stored in `localStorage` as `notewise_user_id_{email}`. This UUID is sent on every API request as the `X-User-Id` header and used for ownership scoping.

> **Note:** This is not production-ready authentication. A real JWT-based auth system (e.g. NextAuth, Supabase Auth, or Auth0) should be integrated before deployment.

---

## Key Design Decisions

**Deep Dive as TSX** — Rather than storing markdown or HTML, the deep dive is stored as a React component. This allows Gemini to produce rich, structured UI with semantic HTML that renders consistently in the iframe sandbox.

**Sandboxed iframe rendering** — AI-generated code is rendered in a `sandbox="allow-scripts"` iframe using Babel Standalone + React from CDN. This isolates the generated code completely from the host application.

**No jobs table polling** — Job status is synthesised from the `sources` table rather than a separate jobs endpoint. The Azure Function updates source status directly, so polling `GET /workspaces/{id}` is sufficient.

**user_id as VARCHAR** — The `workspaces.user_id` column is `VARCHAR` rather than `UUID`. The `get_user_id` dependency validates UUID format but always returns a plain string to avoid PostgreSQL type comparison errors.

**3-step SAS upload** — Files never pass through the backend. The frontend gets a short-lived write-only SAS URL, PUTs the file directly to Azure Blob, then calls `/upload-complete` to finalise the record.

---

## Roadmap

- [ ] Real JWT authentication
- [ ] Audio transcription (Whisper / Azure Speech)
- [ ] Quiz generation
- [ ] AI narration (text-to-speech)
- [ ] Multi-source deep dives (workspace-level, not per source)
- [ ] Dark mode support for deep dive renderer
- [ ] Export to PDF / Markdown

---

## License

MIT
