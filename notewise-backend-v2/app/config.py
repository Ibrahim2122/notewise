from pydantic import ConfigDict
from pydantic_settings import BaseSettings 

class Settings(BaseSettings):
    DATABASE_URL: str
    AZURE_STORAGE_ACCOUNT_NAME: str
    AZURE_STORAGE_ACCOUNT_KEY: str
    AZURE_BLOB_CONTAINER: str = "notewise-dev"
    AZURE_SAS_TTL_MINUTES: int = 15
    DEV_USER_ID: str = "dev-user"
    AZURE_STORAGE_CONNECTION_STRING: str
    ENTRA_TENANT_ID: str
    ENTRA_TENANT_NAME: str
    API_CLIENT_ID: str
    

    model_config = ConfigDict(env_file=".env")

settings = Settings()
