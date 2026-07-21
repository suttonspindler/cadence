# Deploying Cadence

This deploys Cadence as a live, clickable site on **free tiers**:

| Component            | Host                          | Notes                                            |
| -------------------- | ----------------------------- | ------------------------------------------------ |
| Web (Next.js)        | **Render** web service (free) | Sleeps after 15 min idle → ~30–60s cold start.   |
| AI service (FastAPI) | **Render** web service (free) | Same cold-start behavior. Uses hosted embeddings. |
| Postgres + pgvector  | **Neon** (free)               | Non-expiring, unlike Render's free Postgres.     |
| Embeddings           | **Voyage AI** (free tier)     | `voyage-3.5`, 1024-dim — drops into the schema.   |
| Generation (LLM)     | **Anthropic** (`claude-haiku-4-5`) | Optional; retrieval works without it.       |

> **Why not the self-hosted embedding model in prod?** Render's free/Starter web
> services cap at 512 MB RAM; `mxbai-embed-large-v1` needs ~1.5–2 GB, so it would
> only run on the $25/mo Standard plan. The provider is swappable via
> `EMBEDDINGS_PROVIDER`, so we keep the local model for dev and use Voyage in prod.
> Trade-off cost: the deployed embeddings differ from local ones, so the catalog
> **must be re-embedded** after loading data (step 5).

The `render.yaml` blueprint at the repo root defines both Render services. Secrets
are `sync: false` — Render prompts for them on first deploy; nothing secret is in git.

---

## 0. Prerequisites

- The repo pushed to GitHub (Render deploys from a connected repo).
- Local Postgres running with your curated catalog (for the data transplant in step 4).
- `psql` / `pg_dump` installed locally (`brew install libpq` or `postgresql`).
- Accounts: [Render](https://render.com), [Neon](https://neon.tech),
  [Voyage AI](https://voyageai.com), and (optional) an
  [Anthropic API key](https://console.anthropic.com) + Google OAuth credentials.

---

## 1. Database — Neon

1. Create a Neon project. Copy **two** connection strings from the dashboard:
   - **Direct** connection (for migrations/seed/import from your laptop).
   - Either works for the app; the direct string is simplest for this single-server setup.
2. Enable pgvector — the Prisma migration does this (`CREATE EXTENSION vector`), so
   just make sure your Neon role can create extensions (the default owner can).

Keep the connection string handy as `DATABASE_URL` (Neon appends `?sslmode=require`,
which both Prisma and psycopg honor).

---

## 2. Embeddings — Voyage AI

1. Sign up at Voyage AI and create an API key. The free tier is enough for a
   portfolio catalog (the one-time re-embed is rate-limited but retries with backoff).
2. Save the key for `VOYAGE_API_KEY`. Model is `voyage-3.5` (1024-dim).

---

## 3. Auth — Google OAuth (production sign-in)

Dev login is **hard-disabled in production** (`web/auth.ts`), so Google is the live
sign-in path.

1. In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials),
   create (or reuse) an OAuth 2.0 Client ID (type: Web application).
2. You'll add the **Authorized redirect URI** in step 6, once you know the web URL:
   `https://<your-web-service>.onrender.com/api/auth/callback/google`
3. Save the Client ID / Secret for `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

> Skipping Google for now? The site still works read-only (browse, search, assistant);
> only sign-in-gated features (reviews, collections, listening) need it.

---

## 4. Load the catalog into Neon

Transplant your curated local catalog (fastest; preserves all the album/tradition
cleanup), then re-embed in step 5. A **full dump** carries the schema, data, and
the `_prisma_migrations` history in one shot — Prisma then sees Neon as already
migrated, and FKs are added after the data loads, so there's no ordering issue.

If you have `pg_dump`/`psql` locally, use them directly. Otherwise run them
**through the Postgres Docker container** (it ships with both):

```bash
# NEON is your Neon connection string (keep it out of shell history / git).
export NEON="postgresql://...neon.tech/neondb?sslmode=require"

# 4a. Dump the local catalog (schema + data) to a file.
docker compose exec -T db pg_dump -U cadence --no-owner --no-acl cadence > /tmp/cadence-full.sql

# 4b. Restore it into Neon (through the container, which has psql + network).
docker compose exec -T -e PGURL="$NEON" db sh -c 'psql "$PGURL"' < /tmp/cadence-full.sql
```

**Alternative (reproduce from scratch instead of transplanting):**

```bash
cd packages/db
DATABASE_URL="$NEON" npx prisma migrate deploy   # schema + pgvector extension
DATABASE_URL="$NEON" npm run seed
DATABASE_URL="$NEON" npm run enrich
DATABASE_URL="$NEON" npm run import              # slow (MusicBrainz, ~1 req/s)
DATABASE_URL="$NEON" npm run seed-albums
DATABASE_URL="$NEON" npm run enrich-traditions
```

---

## 5. Re-embed against Neon (required)

Production uses Voyage, so the vectors from step 4 (local mxbai model) must be
regenerated in the Voyage vector space — otherwise semantic search returns garbage.

```bash
export NEON="postgresql://...neon.tech/neondb?sslmode=require"
export DATABASE_URL="$NEON"
export EMBEDDINGS_PROVIDER=voyage
export EMBEDDINGS_MODEL=voyage-3.5
export EMBEDDINGS_DIM=1024
export VOYAGE_API_KEY="your-voyage-key"

npm run ai:reindex   # embed all recordings (search + recs)
npm run ai:rag       # rebuild the assistant's RAG chunks
```

This is the rate-limited step; it retries 429s with backoff and may take a while
on the free tier. Run it once now, and again any time the catalog changes.

---

## 6. Deploy on Render

1. Generate the two shared secrets locally:
   ```bash
   openssl rand -base64 33   # → AUTH_SECRET
   openssl rand -base64 33   # → AI_SERVICE_KEY  (use the SAME value on both services)
   ```
2. In Render: **New → Blueprint**, connect the repo. Render reads `render.yaml` and
   creates **cadence-web** and **cadence-ai**, prompting for the `sync: false` vars:

   **cadence-ai**
   - `DATABASE_URL` = Neon string
   - `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY` (optional)
   - `AI_SERVICE_KEY` = the generated secret

   **cadence-web**
   - `DATABASE_URL` = Neon string
   - `AUTH_SECRET` = the generated secret
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   - `AI_SERVICE_KEY` = **same** value as cadence-ai
   - Leave `AUTH_URL` and `AI_SERVICE_URL` for step 7 (they need the deployed URLs).

3. Let both services build and go live. Note their URLs, e.g.
   `https://cadence-web.onrender.com` and `https://cadence-ai.onrender.com`.

---

## 7. Wire up the URLs (post-deploy)

Now that the URLs exist, set the remaining vars and redeploy web:

- **cadence-web** → `AUTH_URL` = `https://cadence-web.onrender.com`
- **cadence-web** → `AI_SERVICE_URL` = `https://cadence-ai.onrender.com`
- **Google Console** → add redirect URI
  `https://cadence-web.onrender.com/api/auth/callback/google`

Trigger a redeploy of cadence-web to pick up the new env vars.

---

## 8. Verify

```bash
# AI service health (public):
curl https://cadence-ai.onrender.com/health
# → {"status":"ok","embeddings_provider":"voyage",...}

# Protected endpoint without the key → 401:
curl -i "https://cadence-ai.onrender.com/search?q=vivaldi"
# Protected endpoint WITH the key → results:
curl -H "X-API-Key: <AI_SERVICE_KEY>" "https://cadence-ai.onrender.com/search?q=vivaldi"
```

Then open the web URL and check: browse loads, **Discover** (`/search`) returns
semantic results, the assistant answers, and Google sign-in works. (First hit after
idle is slow — that's the free-tier cold start.)

---

## Go-live checklist

- [x] Dev login hard-disabled in prod (`NODE_ENV=production`; `ENABLE_DEV_LOGIN` unset).
- [x] AI service requires `X-API-Key` (only `/health` is public).
- [x] No secrets in git (`.env` gitignored; Render vars are `sync: false`).
- [ ] Managed Postgres on Neon (non-expiring, pgvector enabled).
- [ ] Catalog loaded **and re-embedded with Voyage** (step 5).
- [ ] `AUTH_SECRET` / `AI_SERVICE_KEY` are fresh random values (not the dev placeholder).
- [ ] Google redirect URI matches the deployed web URL.

## Notes & upgrades

- **Cold starts** are the free-tier trade-off. To remove them, move either Render
  service to Starter ($7/mo) so it stays warm; the DB (Neon) has no cold-start issue
  that matters here.
- **Keeping the self-hosted model in prod** instead of Voyage: use a Render Standard
  instance (2 GB, ~$25/mo) for cadence-ai, install `requirements.txt` (not `-prod`),
  and set `EMBEDDINGS_PROVIDER=local`. Re-embed with the local model.
- **Rotating the shared secret**: change `AI_SERVICE_KEY` on both services together.
