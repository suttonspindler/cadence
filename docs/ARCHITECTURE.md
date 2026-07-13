# Cadence — Architecture

Cadence is an AI-enhanced classical music discovery and review platform. It models
the relationships that make classical music hard to browse — a single **work** has
many **movements** and many **recordings**, each crediting multiple **artists** in
different roles — and layers semantic discovery, personalized recommendations, and a
cited RAG assistant on top.

## System shape

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Next.js (web/)           │  HTTP  │  FastAPI AI service (ai/)     │
│  • App Router UI          │──────► │  • embeddings pipeline        │
│  • API routes: catalog,   │        │  • semantic search           │
│    auth, reviews,         │        │  • recommendations           │
│    collections, profile   │        │  • RAG assistant + summaries │
└─────────────┬─────────────┘        └───────────────┬──────────────┘
              │ Prisma                                │ SQLAlchemy / psycopg
              ▼                                       ▼
        ┌───────────────────────────────────────────────────┐
        │  Postgres 16 + pgvector  (packages/db owns schema) │
        └───────────────────────────────────────────────────┘
```

Two services, one database. The web app owns all transactional/CRUD work through
Prisma; the Python service owns everything vector- and LLM-shaped. They share the
Postgres instance rather than calling each other for data, which keeps the AI
service simple (read models + write embeddings) and the web app free of a Python
dependency.

## Why this split

- **Full-stack TypeScript** is demonstrated by the Next.js app + Prisma data layer.
- **Python AI engineering** is demonstrated by the FastAPI service: embeddings,
  vector search over pgvector, a recommendation ranker, and a retrieval-augmented
  assistant.
- Sharing one Postgres avoids a data-sync problem and keeps the vector columns
  colocated with the rows they describe.

## Data model

Source of truth: `packages/db/prisma/schema.prisma`.

```
Composer ─< Work ─< Movement
                └─< Recording ─< RecordingCredit >─ Artist
                          ├─< Review        >─ User
                          ├─< Listen         >─ User
                          └─< CollectionItem >─ Collection >─ User
```

- `Recording.embedding` (`vector(1024)`) powers semantic search and recommendations.
- `RagChunk` holds embedded source text (bios, notes, reviews, historical context)
  for the assistant's retrieval step.
- Ratings are multi-dimensional per the product brief: performance quality, sound
  quality, historical authenticity, emotional impact, and recommendation level.

Prisma cannot express vector similarity queries, so those columns are declared as
`Unsupported("vector(1024)")` and are read/written by the Python service via raw SQL.

## AI providers

- **Generation** — Anthropic Claude (`claude-opus-4-8`): the RAG assistant, review
  summarization, and recommendation reasoning. The assistant uses Claude's
  **Citations** so answers are grounded in retrieved `RagChunk`s.
- **Embeddings** — a self-hosted sentence-transformers model
  (`mxbai-embed-large-v1`, 1024-dim) by default: no API key, no rate limits, runs
  offline. Behind a provider interface (`EMBEDDINGS_PROVIDER`) so Voyage AI or
  OpenAI are drop-in swaps, plus a dependency-free `hash` fallback. All providers
  output 1024-dim vectors to match the `vector(1024)` column.

## Repository layout

```
cadence/
├── packages/db/       # Prisma schema (source of truth), client, migrations, seed
├── web/               # Next.js app (Phase 2)
├── ai/                # FastAPI service (Phase 3–4)
├── docs/              # this file and design notes
├── docker-compose.yml # Postgres 16 + pgvector
└── .env.example       # copy to .env
```

## Build phases

1. **Foundation + data model** — repo skeleton, Dockerized Postgres+pgvector, the
   Prisma schema, and a curated seed. *(current)*
2. **Catalog + accounts** — browse Composer → Work → Movement → Recording; auth;
   reviews & multi-dimensional ratings; collections; listening profile.
3. **Semantic discovery** — embed recordings; vector search; recommendation engine
   over listening history and preferences.
4. **RAG assistant** — cited Q&A over catalog knowledge; review summarization.

## Local development

```bash
cp .env.example .env         # fill in ANTHROPIC_API_KEY / VOYAGE_API_KEY when needed
npm install                  # installs workspaces (packages/db, web)
npm run db:up                # start Postgres + pgvector via Docker
npm run db:migrate           # create the schema
npm run db:seed              # load the curated catalog
```

Later phases add `npm run dev` (web) and a `uvicorn` command (ai).
