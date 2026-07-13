from __future__ import annotations

import numpy as np
from psycopg.rows import dict_row

from .db import pool
from .embeddings import get_embedder

# Shared result projection (composer/work/performers) so the web UI can render
# a hit without extra round-trips. `{score}` and the FROM/WHERE/ORDER are filled in.
_PROJECTION = """
    r.slug, r.year, r.tradition,
    w.title AS work, w.slug AS work_slug,
    c.name AS composer, c.slug AS composer_slug,
    (SELECT string_agg(a.name, ', ' ORDER BY a.name)
       FROM "RecordingCredit" rc JOIN "Artist" a ON a.id = rc."artistId"
      WHERE rc."recordingId" = r.id) AS performers
"""

_JOINS = """
FROM "Recording" r
JOIN "Work" w ON w.id = r."workId"
JOIN "Composer" c ON c.id = w."composerId"
"""


def _rows(sql: str, params: dict) -> list[dict]:
    with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        out = cur.fetchall()
    for row in out:
        if row.get("score") is not None:
            row["score"] = round(float(row["score"]), 4)
    return out


def search_recordings(query: str, limit: int = 10) -> list[dict]:
    vec = np.asarray(get_embedder().embed_query(query), dtype=np.float32)
    sql = f"""
        SELECT {_PROJECTION}, 1 - (r.embedding <=> %(vec)s) AS score
        {_JOINS}
        WHERE r.embedding IS NOT NULL
        ORDER BY r.embedding <=> %(vec)s
        LIMIT %(limit)s
    """
    return _rows(sql, {"vec": vec, "limit": limit})


def similar_recordings(recording_id: str, limit: int = 6) -> list[dict]:
    sql = f"""
        WITH src AS (SELECT embedding FROM "Recording" WHERE id = %(id)s)
        SELECT {_PROJECTION}, 1 - (r.embedding <=> (SELECT embedding FROM src)) AS score
        {_JOINS}
        WHERE r.embedding IS NOT NULL
          AND r.id <> %(id)s
          AND (SELECT embedding FROM src) IS NOT NULL
        ORDER BY r.embedding <=> (SELECT embedding FROM src)
        LIMIT %(limit)s
    """
    return _rows(sql, {"id": recording_id, "limit": limit})


def recommend_for_user(user_id: str, limit: int = 10) -> list[dict]:
    # Build a "taste vector" as the average of the embeddings of everything the
    # user has listened to (pgvector's avg aggregate), then find the nearest
    # recordings they haven't heard yet.
    sql = f"""
        WITH taste AS (
            SELECT avg(r.embedding) AS v
            FROM "Listen" l JOIN "Recording" r ON r.id = l."recordingId"
            WHERE l."userId" = %(uid)s AND r.embedding IS NOT NULL
        )
        SELECT {_PROJECTION}, 1 - (r.embedding <=> (SELECT v FROM taste)) AS score
        {_JOINS}
        WHERE r.embedding IS NOT NULL
          AND (SELECT v FROM taste) IS NOT NULL
          AND r.id NOT IN (SELECT "recordingId" FROM "Listen" WHERE "userId" = %(uid)s)
        ORDER BY r.embedding <=> (SELECT v FROM taste)
        LIMIT %(limit)s
    """
    return _rows(sql, {"uid": user_id, "limit": limit})
