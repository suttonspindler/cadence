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
npm run db:complete-album <release-group-mbid>   # fill an album's full tracklist (dedup vs existing)
npm run db:complete-albums   # sweep partial albums (dry-run default; --apply to write)
npm run db:clean-junk-albums # remove compilation/non-album junk albums (--apply; Live = review)
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
Catalog ≈ 45 composers / 204 works / 373 recordings / 241 albums / 557 artists, all embedded
(after a junk-album cleanup — see below).

Two search modes to keep straight: **Discover** (`/search`) is semantic (pgvector); **find**
(`/find`, the header search bar) is strict lexical substring matching over composers / works /
albums / artists, grouped by type. Albums are the join hub — a `Recording` attaches to an
`Album` by the release-group MBID, so importing a recording that shares a release group with an
existing album auto-completes that album (e.g. adding a work's other movements/couplings).

## Data quality & catalog growth (read before importing more)

The composer-first import (`db:import`) is **breadth-first and noisy**: it walks composers →
a few works → a few performances, and historically attached each recording to its *first*
release — often a compilation or amateur/live release. This produced junk associations
(e.g. John Adams *China Gates* on a Drum Corps show) and some junk works. Two things address it:

- **Upstream fix (done):** the importer now scores releases and picks the most album-like one,
  and skips performances that only appear on compilations. It can't undo a recording that only
  exists on a bad release — that's what cleanup/curation are for.
- **Cleanup (done):** `db:clean-junk-albums` classified all albums and removed 87 compilation/
  non-album albums (recordings kept, **detached** → album-less) plus 7 hand-reviewed junk Live
  albums. Live albums are ambiguous by type, so it only *reports* them for manual review.

**Album completion** is the quality-growth path. `db:complete-album <rg-mbid>` pulls a release's
full tracklist, collapses movement tracks into their parent work (via MB `parts` rels), creates
one Recording per work, and attaches it to the album — de-duping against existing recordings by
`workKey (genre+number) | primary-performer surname`, so hand-seeded recordings aren't copied.
It creates composers it doesn't have (era from birth year, bio from Wikipedia). Proven on the
Kleiber Beethoven 5 & 7 album (added the 7th, kept the seed 5th). `db:complete-albums` sweeps
partial albums with guardrails — **but a blanket sweep is the wrong move**: the dry-run showed
most single-recording albums are arbitrary associations, so completion should target *curated*
release groups, not swept indiscriminately.

## Next / considerations for future development

- **Curated completion (paused, next up):** pick ~15 canonical release groups and complete them.
  Needs a small extension — `completeAlbum()` currently *bails if the album isn't already in the
  DB*; to add famous albums we don't have yet, first create the Album row from the release group,
  then complete. The curation (which albums) is a content decision worth confirming with the user.
- **101 detached recordings** are now album-less (real works, lost their junk compilation album).
  Curated completion could re-home some; otherwise they show under works/composers without a cover.
- **Junk works/recordings** beyond albums (e.g. a spurious work by a mis-matched composer) are
  only partially cleaned — detection is fuzzy and was done by hand for the obvious cases.
- **Work-title consistency:** completion uses MB's verbose titles ("Symphony no. 5 in C minor,
  op. 67") next to clean seed titles ("Symphony No. 5"). Normalizing is a nice-to-have.
- **Deploy checklist** lives in the conversation history / could be moved to `docs/DEPLOYMENT.md`;
  blockers: disable dev-login in prod, rotate keys, protect the AI service, managed pgvector,
  decide AI-service hosting (local embedding model needs an always-on container).
