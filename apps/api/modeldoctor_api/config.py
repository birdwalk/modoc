from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    max_upload_mb: int = Field(250, alias="MODELDOCTOR_MAX_UPLOAD_MB")
    storage_dir: Path = Field(Path(".modeldoctor_storage"), alias="MODELDOCTOR_STORAGE_DIR")
    max_triangles: int = Field(2_500_000, alias="MODELDOCTOR_MAX_TRIANGLES")
    max_repair_triangles: int = Field(750_000, alias="MODELDOCTOR_MAX_REPAIR_TRIANGLES")
    allow_step: bool = Field(False, alias="MODELDOCTOR_ALLOW_STEP")
    preview_triangle_limit: int = Field(120_000, alias="MODELDOCTOR_PREVIEW_TRIANGLE_LIMIT")
    openai_api_key: str | None = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4.1-mini", alias="OPENAI_MODEL")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
