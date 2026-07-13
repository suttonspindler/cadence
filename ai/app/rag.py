"""Retrieval layer for the assistant.

Builds a knowledge base in the RagChunk table from catalog prose (composer bios,
work descriptions, recording notes, reviews), embeds each chunk, and retrieves
the most relevant chunks for a question via pgvector similarity.
"""

from __future__ import annotations

import numpy as np
from psycopg.rows import dict_row

from .db import pool
from .embeddings import get_embedder

# Each query returns (title, content, sourceType, sourceId) rows to insert as chunks.
_CHUNK_SOURCES = [
    (
        "COMPOSER_BIO",
        """
        SELECT c.id AS source_id,
               c.name AS title,
               c.name || ' (' || c.era || '). ' || c.bio AS content
        FROM "Composer" c WHERE c.bio IS NOT NULL AND c.bio <> ''
        """,
    ),
    (
        "ARTIST_BIO",
        """
        SELECT a.id AS source_id,
               a.name AS title,
               a.name || '. ' || a.bio AS content
        FROM "Artist" a WHERE a.bio IS NOT NULL AND a.bio <> ''
        """,
    ),
    (
        "WORK_DESCRIPTION",
        """
        SELECT w.id AS source_id,
               w.title || ' — ' || c.name AS title,
               w.title || ' by ' || c.name || '. ' || w.description AS content
        FROM "Work" w JOIN "Composer" c ON c.id = w."composerId"
        WHERE w.description IS NOT NULL AND w.description <> ''
        """,
    ),
    (
        "RECORDING_NOTES",
        """
        SELECT r.id AS source_id,
               w.title || ' — ' || c.name AS title,
               w.title || ' by ' || c.name || ', ' || r.tradition
                 || ' recording. ' || coalesce(r.notes, '')
                 || ' Performed by ' || coalesce((
                    SELECT string_agg(a.name, ', ')
                    FROM "RecordingCredit" rc JOIN "Artist" a ON a.id = rc."artistId"
                    WHERE rc."recordingId" = r.id), '') || '.' AS content
        FROM "Recording" r
        JOIN "Work" w ON w.id = r."workId"
        JOIN "Composer" c ON c.id = w."composerId"
        WHERE r.notes IS NOT NULL AND r.notes <> ''
        """,
    ),
    (
        "REVIEW",
        """
        SELECT rv.id AS source_id,
               'Listener review — ' || w.title AS title,
               rv.body AS content
        FROM "Review" rv
        JOIN "Recording" r ON r.id = rv."recordingId"
        JOIN "Work" w ON w.id = r."workId"
        WHERE rv.body IS NOT NULL AND rv.body <> ''
        """,
    ),
]


def build_chunks() -> dict:
    """Rebuild the RagChunk knowledge base from current catalog content."""
    embedder = get_embedder()

    with pool.connection() as conn:
        rows: list[dict] = []
        with conn.cursor(row_factory=dict_row) as cur:
            for source_type, sql in _CHUNK_SOURCES:
                cur.execute(sql)
                for row in cur.fetchall():
                    rows.append({**row, "source_type": source_type})

        vectors = embedder.embed_documents([r["content"] for r in rows]) if rows else []

        with conn.cursor() as cur:
            cur.execute('DELETE FROM "RagChunk"')
            for row, vec in zip(rows, vectors):
                cur.execute(
                    'INSERT INTO "RagChunk" (id, "sourceType", "sourceId", title, content, embedding, "createdAt")'
                    " VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, now())",
                    (
                        row["source_type"],
                        row["source_id"],
                        row["title"],
                        row["content"],
                        np.asarray(vec, dtype=np.float32),
                    ),
                )
        conn.commit()

    return {"chunks": len(rows), "provider": getattr(embedder, "name", "unknown")}


def retrieve(query: str, k: int = 6) -> list[dict]:
    vec = np.asarray(get_embedder().embed_query(query), dtype=np.float32)
    sql = """
        SELECT id, "sourceType" AS source_type, "sourceId" AS source_id,
               title, content, 1 - (embedding <=> %(vec)s) AS score
        FROM "RagChunk"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %(vec)s
        LIMIT %(k)s
    """
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, {"vec": vec, "k": k})
        return cur.fetchall()
