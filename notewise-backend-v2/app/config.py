from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    AZURE_STORAGE_ACCOUNT_NAME: str
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_BLOB_CONTAINER: str = "notewise-dev"
    DEV_USER_ID: str = "dev-user"
    ENTRA_TENANT_ID: str
    ENTRA_TENANT_NAME: str
    API_CLIENT_ID: str

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

    model_config = ConfigDict(env_file=".env")

settings = Settings()
