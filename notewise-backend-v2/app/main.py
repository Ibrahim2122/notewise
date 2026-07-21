from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.health import router as health_router
from app.routes.workspaces import router as workspaces_router
from app.routes.sources import router as sources_router
from app.routes.sources_attach import router as sources_attach_router
from app.routes.dashboard import router as dashboard_router
from app.routes.deepdive import router as deepdive_router

app = FastAPI()

# ---------------------------------------------------------------------------
# CORS — allowed origins come from ALLOWED_ORIGINS in .env.development /
# .env.production, so dev and prod get different origins automatically.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
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