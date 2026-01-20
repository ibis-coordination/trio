"""Configuration settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
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

    # Path to YAML file with trio model definitions
    trio_models_path: str = "trio_models.yml"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


_trio_models: dict[str, Any] | None = None


def get_trio_models() -> dict[str, Any]:
    """Load and cache trio model definitions from YAML file.

    Returns a dict mapping model_name to trio_params.
    """
    global _trio_models
    if _trio_models is None:
        path = Path(get_settings().trio_models_path)
        if path.exists():
            with open(path) as f:
                data = yaml.safe_load(f)
                trio_model_list = data.get("trio_model_list", []) if data else []
                _trio_models = {
                    item["model_name"]: item["trio_params"]
                    for item in trio_model_list
                    if "model_name" in item and "trio_params" in item
                }
        else:
            _trio_models = {}
    return _trio_models
