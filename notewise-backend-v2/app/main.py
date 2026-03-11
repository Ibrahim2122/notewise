from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.workspaces import router as workspaces_router
from app.routes.sources import router as sources_router
from app.routes.sources_attach import router as sources_attach_router
from app.routes.dashboard import router as dashboard_router
from app.routes.deepdive import router as deepdive_router

app = FastAPI()

# ---------------------------------------------------------------------------
# CORS — allow the Next.js dev server to talk to this API.
# In production, replace the origins list with your real frontend domain(s).
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],   # includes OPTIONS preflight
    allow_headers=["*"],   # includes X-User-Id and Content-Type
)


@app.get("/")
def read_root():
    return {"Hello": "World"}


# app.include_router(health_router)
app.include_router(workspaces_router)
app.include_router(sources_router)
app.include_router(sources_attach_router)
app.include_router(dashboard_router)
app.include_router(deepdive_router)