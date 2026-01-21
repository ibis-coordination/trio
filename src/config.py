"""Configuration settings loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings.

    All settings can be overridden via environment variables.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Backend LLM URL (LiteLLM proxy or direct Ollama)
    trio_backend_url: str = "http://litellm:4000"

    # Service port
    trio_port: int = 8000

    # Timeout for each model request (seconds)
    trio_timeout: int = 120


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
