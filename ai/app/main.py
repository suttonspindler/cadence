import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from .assistant import answer as assistant_answer
from .assistant import summarize_reviews
from .config import settings
from .embeddings import get_embedder
from .rag import build_chunks
from .reindex import reindex_recordings
from .search import recommend_for_user, search_recordings, similar_recordings

app = FastAPI(title="Cadence AI Service", version="0.1.0")


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    # When AI_SERVICE_KEY is set (production), every endpoint except /health
    # requires a matching X-API-Key header. Unset (local dev) leaves it open.
    expected = settings.ai_service_key
    if expected and request.url.path != "/health":
        if request.headers.get("x-api-key") != expected:
            return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key."})
    return await call_next(request)


@app.exception_handler(httpx.HTTPStatusError)
def _embedding_provider_error(_request, exc: httpx.HTTPStatusError):
    # Surface upstream embedding-provider failures (e.g. Voyage 429 rate limit)
    # as a clean 503 the web UI can degrade on, not a 500 stack trace.
    status = exc.response.status_code
    detail = "Embedding provider rate-limited; try again shortly." if status == 429 else "Embedding provider error."
    return JSONResponse(status_code=503, content={"detail": detail, "upstream_status": status})


@app.get("/health")
def health() -> dict:
    embedder = get_embedder()
    return {
        "status": "ok",
        "embeddings_provider": getattr(embedder, "name", "unknown"),
        "embeddings_dim": embedder.dim,
        "configured_provider": settings.embeddings_provider,
    }


@app.post("/reindex")
def reindex() -> dict:
    return reindex_recordings()


@app.get("/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50)) -> dict:
    return {"query": q, "results": search_recordings(q, limit)}


@app.get("/recordings/{recording_id}/similar")
def similar(recording_id: str, limit: int = Query(6, ge=1, le=50)) -> dict:
    return {"results": similar_recordings(recording_id, limit)}


@app.get("/users/{user_id}/recommendations")
def recommendations(user_id: str, limit: int = Query(10, ge=1, le=50)) -> dict:
    return {"results": recommend_for_user(user_id, limit)}


@app.post("/rag/reindex")
def rag_reindex() -> dict:
    return build_chunks()


@app.get("/assistant")
def assistant(q: str = Query(..., min_length=1)) -> dict:
    return assistant_answer(q)


@app.get("/recordings/{recording_id}/review-summary")
def review_summary(recording_id: str) -> dict:
    return summarize_reviews(recording_id)
