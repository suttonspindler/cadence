from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# The canonical .env lives at the repo root (shared with the web app).
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra="ignore")

    # Field names map case-insensitively to env vars (database_url -> DATABASE_URL).
    database_url: str = "postgresql://cadence:cadence@localhost:5432/cadence"

    embeddings_provider: str = "local"  # local | voyage | openai | hash
    embeddings_model: str = "voyage-3.5"  # used by cloud providers
    # Self-hosted sentence-transformers model (1024-dim, matches the pgvector column).
    local_embeddings_model: str = "mixedbread-ai/mxbai-embed-large-v1"
    embeddings_dim: int = 1024

    voyage_api_key: str | None = None
    openai_api_key: str | None = None

    # Shared secret guarding this service's HTTP endpoints. When set, callers
    # (the web app) must send it as the `X-API-Key` header; when unset (local
    # dev) the service is open. See main.py's api_key_guard middleware.
    ai_service_key: str | None = None

    # Generation (RAG assistant, review summaries) via Claude.
    anthropic_api_key: str | None = None
    llm_model: str = Field(default="claude-opus-4-8", validation_alias="CADENCE_LLM_MODEL")


settings = Settings()

