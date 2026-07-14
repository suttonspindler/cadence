// Minimal MusicBrainz API client: rate-limited to ~1 req/sec (their policy),
// sends a proper User-Agent, and caches responses on disk so re-runs and
// development don't re-hit the API.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";
const CACHE_DIR = path.resolve(__dirname, ".cache");

let lastRequest = 0;

async function throttle() {
  const elapsed = Date.now() - lastRequest;
  const wait = Math.max(0, 1100 - elapsed); // 1 req/sec + margin
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

function cacheFile(pathAndQuery: string): string {
  const hash = crypto.createHash("sha1").update(pathAndQuery).digest("hex");
  return path.join(CACHE_DIR, `${hash}.json`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a MusicBrainz endpoint (path + query, no fmt). Cached, throttled, and
 *  resilient to transient 503/429/network errors via exponential backoff. */
export async function mbGet<T = unknown>(pathAndQuery: string): Promise<T> {
  const file = cacheFile(pathAndQuery);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as T;

  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${MB_BASE}${pathAndQuery}${sep}fmt=json`;

  let delay = 2000;
  for (let attempt = 0; attempt < 5; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if ((res.status === 503 || res.status === 429) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after")) || delay / 1000;
      await sleep(Math.min(retryAfter * 1000, 15000));
      delay *= 2;
      continue;
    }
    if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${url}`);
    const data = (await res.json()) as T;
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  }
  throw new Error(`MusicBrainz retries exhausted for ${url}`);
}

// --- Typed shapes (only the fields we use) ---------------------------------

export type MbArtist = {
  id: string;
  name: string;
  "sort-name"?: string;
  type?: string; // "Person" | "Group" | ...
  country?: string;
  area?: { name?: string };
  "life-span"?: { begin?: string; end?: string };
  score?: number;
};

export type MbWork = { id: string; title: string; type?: string };

export type MbRelease = {
  id: string;
  title?: string;
  date?: string;
  "release-group"?: { id: string; title?: string };
  "label-info"?: { label?: { name?: string } }[];
};

export type MbRecording = {
  id: string;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: { name: string; artist: MbArtist; joinphrase?: string }[];
  relations?: MbRelation[];
  releases?: MbRelease[];
};

export type MbRelation = {
  type: string; // "conductor" | "performer" | "performing orchestra" | "instrument" | ...
  direction: string;
  artist?: MbArtist;
  attributes?: string[];
};

/** Search for a composer by name; returns the best Person match. A loose query
 *  (not an exact-phrase field query) handles transliterations/name variants —
 *  e.g. "Frédéric Chopin" resolves to MusicBrainz's canonical "Fryderyk Chopin". */
export async function searchComposer(name: string): Promise<MbArtist | null> {
  const data = await mbGet<{ artists?: MbArtist[] }>(
    `/artist?query=${encodeURIComponent(name)}&limit=8`,
  );
  const artists = data.artists ?? [];
  // Results come back scored (desc); prefer the top-scored Person.
  return artists.find((a) => a.type === "Person") ?? artists[0] ?? null;
}

/** Browse works composed by an artist (paged; we take the first page). */
export async function worksByComposer(artistMbid: string, limit = 25): Promise<MbWork[]> {
  const data = await mbGet<{ works?: MbWork[] }>(`/work?artist=${artistMbid}&limit=${limit}`);
  return data.works ?? [];
}

/** Recording stubs that are performances of a work (via the work's relationships). */
export async function workRecordings(
  workMbid: string,
  limit = 6,
): Promise<{ id: string; title: string }[]> {
  const data = await mbGet<{
    relations?: { type: string; recording?: { id: string; title: string } }[];
  }>(`/work/${workMbid}?inc=recording-rels`);
  const out: { id: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const rel of data.relations ?? []) {
    if (rel.type !== "performance" || !rel.recording) continue;
    if (seen.has(rel.recording.id)) continue;
    seen.add(rel.recording.id);
    out.push(rel.recording);
    if (out.length >= limit) break;
  }
  return out;
}

/** Full recording lookup: artist credits, performer/conductor relations, and
 *  releases with their release-group + label (for the Album). */
export async function getRecording(recMbid: string): Promise<MbRecording> {
  return mbGet<MbRecording>(
    `/recording/${recMbid}?inc=artist-credits+artist-rels+releases+release-groups`,
  );
}
