from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # DB
    DATABASE_URL: str = "postgresql+asyncpg://house3d:house3d_secret@localhost:5432/house3d"
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    # Security
    SECRET_KEY: str = "changeme"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "3D House Planning API"
    VERSION: str = "0.1.0"

settings = Settings()
