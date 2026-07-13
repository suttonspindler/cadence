from __future__ import annotations

import numpy as np
from psycopg.rows import dict_row

from .db import pool
from .documents import build_recording_document
from .embeddings import get_embedder

_FETCH_SQL = """
SELECT r.id, r.year, r.label, r.tradition, r.notes,
       w.title AS work, w.genre, w.key AS key, w."catalogNumber" AS catalog_number,
       w.description AS work_desc,
       c.name AS composer, c.era AS era, c.bio AS composer_bio,
       (SELECT string_agg(m.title, '; ' ORDER BY m.position)
          FROM "Movement" m WHERE m."workId" = w.id) AS movements,
       (SELECT string_agg(a.name || ' (' || rc.role || ')', ', ')
          FROM "RecordingCredit" rc JOIN "Artist" a ON a.id = rc."artistId"
         WHERE rc."recordingId" = r.id) AS performers
FROM "Recording" r
JOIN "Work" w ON w.id = r."workId"
JOIN "Composer" c ON c.id = w."composerId"
"""


def reindex_recordings() -> dict:
    """Embed every recording's document and store it in the pgvector column."""
    embedder = get_embedder()

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_FETCH_SQL)
            rows = cur.fetchall()

        docs = [build_recording_document(row) for row in rows]
        vectors = embedder.embed_documents(docs) if docs else []

        with conn.cursor() as cur:
            for row, vec in zip(rows, vectors):
                cur.execute(
                    'UPDATE "Recording" SET embedding = %s WHERE id = %s',
                    (np.asarray(vec, dtype=np.float32), row["id"]),
                )
        conn.commit()

    return {"embedded": len(rows), "provider": getattr(embedder, "name", "unknown"), "dim": embedder.dim}
