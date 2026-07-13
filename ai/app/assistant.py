"""Claude-powered generation: the RAG assistant (cited answers) and review
summarization. Both degrade to a structured error when no API key is set."""

from __future__ import annotations

import anthropic

from .config import settings
from .db import pool
from .rag import retrieve

_ASSISTANT_SYSTEM = (
    "You are a knowledgeable, concise classical-music guide. Answer the user's question "
    "using only the provided source documents. Cite the sources that support each factual "
    "claim. If the sources don't contain the answer, say so briefly rather than guessing."
)

_SUMMARY_SYSTEM = (
    "Summarize the consensus and the notable disagreements across these listener reviews of a "
    "single classical recording, in 2-3 balanced, specific sentences. Write plain prose only — "
    "no markdown, headings, bullet points, or preamble. Do not invent details."
)

# sourceType -> (SQL to fetch a slug from the source id, URL template)
_LINK_QUERIES = {
    "COMPOSER_BIO": ('SELECT slug FROM "Composer" WHERE id = %s', "/composers/{}"),
    "WORK_DESCRIPTION": ('SELECT slug FROM "Work" WHERE id = %s', "/works/{}"),
    "RECORDING_NOTES": ('SELECT slug FROM "Recording" WHERE id = %s', "/recordings/{}"),
    "REVIEW": (
        'SELECT r.slug FROM "Review" rv JOIN "Recording" r ON r.id = rv."recordingId" WHERE rv.id = %s',
        "/recordings/{}",
    ),
}


def _resolve_url(source_type: str, source_id: str | None) -> str | None:
    entry = _LINK_QUERIES.get(source_type)
    if not entry or not source_id:
        return None
    sql, template = entry
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(sql, (source_id,))
        row = cur.fetchone()
    return template.format(row[0]) if row else None


def answer(question: str, k: int = 6) -> dict:
    chunks = retrieve(question, k)
    if not chunks:
        return {"question": question, "answer": None, "citations": [], "error": "no_context"}
    if not settings.anthropic_api_key:
        return {
            "question": question,
            "answer": None,
            "citations": [],
            "error": "llm_not_configured",
            "retrieved": [c["title"] for c in chunks],
        }

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    documents = [
        {
            "type": "document",
            "source": {"type": "text", "media_type": "text/plain", "data": c["content"]},
            "title": c["title"],
            "citations": {"enabled": True},
        }
        for c in chunks
    ]

    try:
        resp = client.messages.create(
            model=settings.llm_model,
            max_tokens=1024,
            system=_ASSISTANT_SYSTEM,
            messages=[{"role": "user", "content": [*documents, {"type": "text", "text": question}]}],
        )
    except anthropic.APIError as exc:
        return {"question": question, "answer": None, "citations": [], "error": f"llm_error: {exc}"}

    parts: list[str] = []
    cited: dict[int, str] = {}
    for block in resp.content:
        if block.type == "text":
            parts.append(block.text)
            for cit in getattr(block, "citations", None) or []:
                idx = getattr(cit, "document_index", None)
                if idx is not None and idx not in cited:
                    cited[idx] = getattr(cit, "cited_text", "")

    citations = [
        {
            "title": chunks[i]["title"],
            "url": _resolve_url(chunks[i]["source_type"], chunks[i]["source_id"]),
            "cited_text": text,
        }
        for i, text in cited.items()
        if i < len(chunks)
    ]

    return {
        "question": question,
        "answer": "".join(parts),
        "citations": citations,
        "sources_used": len(chunks),
        "error": None,
    }


def summarize_reviews(recording_id: str, min_reviews: int = 2) -> dict:
    with pool.connection() as conn, conn.cursor() as cur:
        cur.execute(
            'SELECT body FROM "Review" WHERE "recordingId" = %s AND body IS NOT NULL AND body <> \'\'',
            (recording_id,),
        )
        bodies = [row[0] for row in cur.fetchall()]

    if len(bodies) < min_reviews:
        return {"summary": None, "count": len(bodies), "error": "not_enough_reviews"}
    if not settings.anthropic_api_key:
        return {"summary": None, "count": len(bodies), "error": "llm_not_configured"}

    joined = "\n\n".join(f"Review {i + 1}: {b}" for i, b in enumerate(bodies))
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    try:
        resp = client.messages.create(
            model=settings.llm_model,
            max_tokens=300,
            system=_SUMMARY_SYSTEM,
            messages=[{"role": "user", "content": joined}],
        )
    except anthropic.APIError as exc:
        return {"summary": None, "count": len(bodies), "error": f"llm_error: {exc}"}

    summary = "".join(b.text for b in resp.content if b.type == "text")
    return {"summary": summary, "count": len(bodies), "error": None}
