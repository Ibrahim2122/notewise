import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings

# ENVIRONMENT selects which env file is loaded: .env.development (default) or
# .env.production. Defaults to "development" so a missing/unset ENVIRONMENT
# never accidentally picks up production config.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
ENV_FILE = Path(__file__).resolve().parent.parent / f".env.{ENVIRONMENT}"

# Also populate os.environ so code that reads env vars directly (e.g.
# OPENROUTER_API_KEY in routes/workspaces.py) sees the same values.
load_dotenv(ENV_FILE)


class Settings(BaseSettings):
    DATABASE_URL: str
    AZURE_STORAGE_ACCOUNT_NAME: str
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_BLOB_CONTAINER: str = "notewise-dev"
    DEV_USER_ID: str = "dev-user"
    ENTRA_TENANT_ID: str
    ENTRA_TENANT_NAME: str
    API_CLIENT_ID: str
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"

    # Derived from AZURE_STORAGE_CONNECTION_STRING — not set in .env
    AZURE_STORAGE_ACCOUNT_KEY: str = ""

    @model_validator(mode="after")
    def _derive_account_key(self):
        if not self.AZURE_STORAGE_ACCOUNT_KEY:
            for part in self.AZURE_STORAGE_CONNECTION_STRING.split(";"):
                if part.startswith("AccountKey="):
                    self.AZURE_STORAGE_ACCOUNT_KEY = part[len("AccountKey="):]
                    break
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = ConfigDict(env_file=ENV_FILE)

settings = Settings()
