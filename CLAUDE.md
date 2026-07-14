# Cadence — agent guide

AI-enhanced classical music discovery + review platform. **Portfolio project targeting
AI-engineering roles** — full-stack + complex relational modeling + recommendation
systems + RAG/LLM/embeddings. Bias toward production quality over quick hacks.

For the full design see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); for setup see
[`README.md`](README.md). This file is the fast-start for working in the repo.

## Monorepo (npm workspaces)

- **`packages/db/`** — Prisma schema is the **single source of truth** for the data
  model. Holds migrations, the seed, and the `import/` + `scripts/` data pipeline.
- **`web/`** — Next.js **16** (App Router). ⚠️ Its APIs differ from training data —
  see `web/AGENTS.md`; read `node_modules/next/dist/docs/` before writing Next code.
  Async `params`/`searchParams`, server actions, Suspense streaming, force-dynamic pages.
- **`ai/`** — FastAPI (Python). Embeddings, vector search, recommendations, RAG.
  Reads/writes the pgvector columns via **raw SQL** (Prisma can't express vector ops).
- **Postgres 16 + pgvector** in Docker (`docker-compose.yml`), all creds `cadence`, :5432.

## Data model — three-tier classical model

```
Composer ─< Work ─< Movement
                └─< Recording ─< RecordingCredit >─ Artist
                        │  └─ Album            (cover art lives here)
                        ├─< Review        >─ User
                        ├─< Listen        >─ User
                        └─< CollectionItem >─ Collection >─ User
```

- **Work** = the composition (*The Four Seasons*). **Recording** = one performance of it
  (*Podger's Four Seasons*). **Album** = the release it appears on. Modeled after Apple
  Music Classical / Presto Music — the Work page compares performances; the Album
  collapses reissues (≈ a MusicBrainz release group) and carries the cover art.
- `Recording.embedding vector(1024)` → semantic search + recs. `RagChunk` → assistant
  retrieval. Both declared `Unsupported("vector(1024)")` in Prisma; the Python service
  handles similarity in raw SQL.
- `Recording.tradition` (`PerformanceTradition`: period / HIP / romantic / traditional /
  modern) — **part of the embedded document text**, so changing it affects search.
- Seed recordings have `musicbrainzId = null` (hand-curated); imported ones carry a MBID.

## Key commands

```
# DB (packages/db)
npm run db:up                # Postgres + pgvector in Docker
npm run db:migrate           # apply migrations (see gotcha — deploy, not dev)
npm run db:seed              # curated seed catalog
npm run db:enrich            # Wikipedia bios + portraits
npm run db:import            # MusicBrainz catalog + Cover Art Archive (slow, cached)
npm run db:seed-albums       # pin the 13 seed recordings to hand-verified albums
npm run db:enrich-traditions # infer PerformanceTradition for imported recordings
npm run db:studio            # Prisma Studio

# AI (ai/) — run after any catalog change
npm run ai:install           # create ai/.venv (first time)
npm run ai:dev               # FastAPI → :8000
npm run ai:reindex           # embed recordings into pgvector (search + recs)
npm run ai:rag               # build the assistant's RAG chunks

# Web
npm run dev --workspace web  # → :3000
```

## Gotchas (learned the hard way)

- **Migrations**: `prisma migrate dev` is interactive → blocked in this env. Hand-author
  the migration SQL and apply with `prisma migrate deploy`.
- **Re-embed after any catalog/tradition change**: run `ai:reindex` **and** `ai:rag`, or
  search/recs/assistant go stale (this bit us — search returned only seed data once).
- **Stale Prisma client**: after a schema change, restart the web dev server — new models
  are `undefined` at runtime until the client reloads.
- **Env loading**: `prisma.config.ts`, the seed, and scripts load the **root `.env`** via
  dotenv (not `packages/db/.env`).
- **MusicBrainz**: 1 req/sec, User-Agent required. Client caches to
  `packages/db/import/.cache/` and retries 503/429 with backoff. `inc=...+labels` on a
  recording lookup is a 400 — don't add it.
- **Cover art**: Cover Art Archive URLs 307-redirect to dynamic archive.org hosts and are
  often stored as `http://`. `CoverArt` normalizes them to `https` and runs them through
  Next's image optimizer (the optimizer follows the redirect server-side; hosts are
  allowlisted in `next.config.ts` `images.remotePatterns`, and `minimumCacheTTL` keeps
  optimized WebP variants cached). A music-note placeholder fades out as the cover loads.
- **Embeddings**: self-hosted `mxbai-embed-large-v1` (1024-dim, no key, offline).
  Swapped off Voyage AI due to free-tier rate limits. Provider is behind
  `EMBEDDINGS_PROVIDER` (local / voyage / openai / hash).
- **LLM**: configurable via `CADENCE_LLM_MODEL`. Code default is `claude-opus-4-8`; this
  project's `.env` runs **`claude-haiku-4-5`** (cost choice) for the assistant + review
  summaries. Retrieval works without a key; generation needs `ANTHROPIC_API_KEY`.

## Status

Phases 1–5 complete (foundation → accounts/reviews → semantic discovery → RAG assistant →
real-data import) plus polish: three-tier Album model, hand-pinned seed albums, tradition
enrichment, browse pagination + filters, account pages (profile hub, `/recommendations`,
`/reviews`, `/listening`, `/settings`, header account dropdown), a keyword search
(`/find` + header search bar) alongside semantic Discover (`/search`), an `/artists/[slug]`
page, and Next-optimized cover art.
Catalog ≈ 44 composers / 204 works / 379 recordings / 335 albums / 562 artists, all embedded.

Two search modes to keep straight: **Discover** (`/search`) is semantic (pgvector); **find**
(`/find`, the header search bar) is strict lexical substring matching over composers / works /
albums / artists, grouped by type. Albums are the join hub — a `Recording` attaches to an
`Album` by the release-group MBID, so importing a recording that shares a release group with an
existing album auto-completes that album (e.g. adding a work's other movements/couplings).
