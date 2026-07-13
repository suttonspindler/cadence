# Cadence

An **AI-enhanced classical music discovery and review platform**. Classical music is
hard to explore because the same work exists in hundreds of recordings across
different performers, ensembles, conductors, and performance traditions. Cadence
models those relationships — Composer → Work → Movement → Recording — and layers
semantic search, personalized recommendations, and a cited AI assistant on top.

Built as a full-stack + AI-engineering portfolio project: complex relational data
modeling (PostgreSQL + Prisma), a Next.js/TypeScript app, a Python AI service
(embeddings, vector search, recommendations, RAG), and Dockerized infrastructure.

## Stack

- **Web** — Next.js (App Router) + TypeScript, Prisma ORM
- **AI service** — FastAPI (Python): embeddings, semantic search, recommendations, RAG
- **Database** — PostgreSQL 16 + pgvector (single source of truth)
- **AI** — Anthropic Claude (`claude-opus-4-8`) for generation; self-hosted sentence-transformers embeddings by default (Voyage AI / OpenAI optional)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Getting started

Prerequisites: Node ≥ 20, Docker, and (for later phases) Python ≥ 3.11.

```bash
cp .env.example .env     # fill in API keys when you reach the AI phases
npm install
npm run db:up            # Postgres + pgvector in Docker
npm run db:migrate       # apply the schema
npm run db:seed          # load the curated classical catalog
npm run db:studio        # (optional) browse the data in Prisma Studio

npm run dev --workspace web   # web app → http://localhost:3000
```

For the AI service (semantic search & recommendations):

```bash
npm run ai:install       # create ai/.venv and install deps (first time)
npm run ai:dev           # AI service → http://localhost:8000
npm run ai:reindex       # embed the catalog into pgvector (search & recommendations)
npm run ai:rag           # build the assistant's knowledge base (RAG)
```

The **assistant** (`/ask`) and **review summaries** use Claude — set
`ANTHROPIC_API_KEY` in `.env`. Retrieval works without it; generation needs it.

Embeddings run on a **self-hosted local model** by default
(`mxbai-embed-large-v1`, 1024-dim) — no API key, no rate limits, offline. The
first `ai:install`/reindex downloads the model (~670MB). To use a cloud provider
instead, set `EMBEDDINGS_PROVIDER=voyage` (+ `VOYAGE_API_KEY`) or `=openai`.

## Status

- [x] **Phase 1** — Foundation: repo, Dockerized Postgres+pgvector, data model, seed
- [x] **Phase 2** — Catalog browse, auth (Google + dev login), reviews & ratings, mark-as-listened, collections, profile
- [x] **Phase 3** — AI discovery: self-hosted embeddings (mxbai-embed-large, Voyage/OpenAI optional), semantic search (/search), similar recordings, personalized recommendations
- [x] **Phase 4** — RAG assistant (`/ask`, Claude cited answers) + AI review summarization
