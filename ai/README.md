# Cadence AI Service

FastAPI service that powers Cadence's AI discovery: it embeds recordings into the
shared Postgres/pgvector database and serves semantic search, similar-recording,
and personalized recommendation queries. Generation (the RAG assistant, review
summaries) lands here in Phase 4.

## Layout

```
ai/
├── app/
│   ├── config.py       # settings from the repo-root .env
│   ├── db.py           # psycopg pool + pgvector registration
│   ├── embeddings.py   # swappable embedders: Voyage | OpenAI | local fallback
│   ├── documents.py    # builds the text document embedded per recording
│   ├── reindex.py      # embeds all recordings into the pgvector column
│   ├── search.py       # search / similar / recommend queries
│   └── main.py         # FastAPI routes
└── requirements.txt
```

## Embedding providers

Selected by `EMBEDDINGS_PROVIDER` in the root `.env`. All output
`EMBEDDINGS_DIM` (1024) vectors so they interchange against the same column.

- **voyage** (default) — Voyage AI `voyage-3.5`; needs `VOYAGE_API_KEY`.
- **openai** — `text-embedding-3-*`; needs `OPENAI_API_KEY`.
- **local** — dependency-free signed feature-hashing; no key. Automatic fallback
  when the configured provider has no key, so the pipeline runs offline. Gives
  lexical similarity, not true semantics — set a key for real quality.

## Run

```bash
cd ai
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

Requires Postgres running (`npm run db:up` from the repo root) and the schema
migrated + seeded.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status + active embedding provider/dim |
| POST | `/reindex` | Embed every recording into pgvector |
| GET | `/search?q=&limit=` | Semantic search over recordings |
| GET | `/recordings/{id}/similar?limit=` | Nearest recordings by embedding |
| GET | `/users/{id}/recommendations?limit=` | Recs from the user's average taste vector, excluding what they've heard |

Reindex without the server running:

```bash
cd ai && ./.venv/bin/python -c "from app.reindex import reindex_recordings as r; print(r())"
```
