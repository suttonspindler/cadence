"""Swappable embedding providers.

Generation uses Claude; embeddings need a dedicated provider. Voyage AI is the
default (Anthropic's recommendation), OpenAI is a drop-in alternative, and a
dependency-free local hashing embedder lets the whole pipeline run end-to-end
with no API key (useful for development and CI). All providers output vectors of
`settings.embeddings_dim` so they interchange against the same pgvector column.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import time
from functools import lru_cache
from typing import Protocol

import httpx

from .config import settings

logger = logging.getLogger("cadence.embeddings")

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class Embedder(Protocol):
    dim: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class LocalHashEmbedder:
    """Signed feature-hashing bag-of-words. Not a semantic model, but it gives
    real lexical similarity (shared words -> nearer vectors) with zero deps or
    network, so search/recommendations return sensible results offline. Swap in
    Voyage/OpenAI for true semantic quality."""

    name = "local"

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def _embed_one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _TOKEN_RE.findall(text.lower()):
            h = int.from_bytes(hashlib.md5(token.encode()).digest()[:8], "big")
            idx = h % self.dim
            sign = 1.0 if (h >> 8) & 1 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_one(text)


class VoyageEmbedder:
    name = "voyage"

    def __init__(self, api_key: str, model: str, dim: int) -> None:
        self.api_key = api_key
        self.model = model
        self.dim = dim

    def _post(self, batch: list[str], input_type: str) -> httpx.Response:
        # The free tier has a low requests-per-minute cap; retry 429s with
        # exponential backoff, honoring Retry-After when present.
        delay = 2.0
        for attempt in range(4):
            resp = httpx.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": batch, "input_type": input_type},
                timeout=60,
            )
            if resp.status_code == 429 and attempt < 3:
                wait = float(resp.headers.get("retry-after", delay))
                time.sleep(min(wait, 20))
                delay *= 2
                continue
            resp.raise_for_status()
            return resp
        resp.raise_for_status()
        return resp

    def _embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        out: list[list[float]] = []
        for i in range(0, len(texts), 100):  # Voyage caps inputs per request
            resp = self._post(texts[i : i + 100], input_type)
            out.extend(item["embedding"] for item in resp.json()["data"])
        return out

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "document")

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text], "query")[0]


class OpenAIEmbedder:
    name = "openai"

    def __init__(self, api_key: str, model: str, dim: int) -> None:
        self.api_key = api_key
        self.model = model
        self.dim = dim

    def _embed(self, texts: list[str]) -> list[list[float]]:
        resp = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"model": self.model, "input": texts, "dimensions": self.dim},
            timeout=60,
        )
        resp.raise_for_status()
        return [item["embedding"] for item in resp.json()["data"]]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text])[0]


# mxbai / bge retrieval models expect queries (not documents) to carry this instruction.
_QUERY_PROMPT = "Represent this sentence for searching relevant passages: "


class SentenceTransformerEmbedder:
    """Self-hosted embedding model (default). No API key, no rate limits, runs
    offline. The model is downloaded once and cached by sentence-transformers."""

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer  # heavy; import lazily

        self._model = SentenceTransformer(model_name)
        self.dim = self._model.get_sentence_embedding_dimension()
        self.name = f"local:{model_name.split('/')[-1]}"

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._model.encode(texts, normalize_embeddings=True).tolist()

    def embed_query(self, text: str) -> list[float]:
        return self._model.encode(_QUERY_PROMPT + text, normalize_embeddings=True).tolist()


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    """Resolve the active embedder. Cached so heavy models load once per process."""
    provider = settings.embeddings_provider.lower()

    if provider == "voyage" and settings.voyage_api_key:
        return VoyageEmbedder(settings.voyage_api_key, settings.embeddings_model, settings.embeddings_dim)
    if provider == "openai" and settings.openai_api_key:
        model = settings.embeddings_model if "embedding" in settings.embeddings_model else "text-embedding-3-small"
        return OpenAIEmbedder(settings.openai_api_key, model, settings.embeddings_dim)
    if provider in ("local", "sentence-transformers", "st"):
        try:
            return SentenceTransformerEmbedder(settings.local_embeddings_model)
        except Exception as exc:  # sentence-transformers not installed / model download failed
            logger.warning("Local model unavailable (%s); using hash fallback.", exc)
            return LocalHashEmbedder(settings.embeddings_dim)

    # Explicit "hash", or a configured cloud provider with no key: dependency-free fallback.
    if provider != "hash":
        logger.warning("Provider %r not usable; using hash fallback.", provider)
    return LocalHashEmbedder(settings.embeddings_dim)
