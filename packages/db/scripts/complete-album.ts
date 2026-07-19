// Album-completion importer.
//
// Given an album's MusicBrainz release-group id, pull a representative release's
// full tracklist, collapse movement tracks into their parent works, and create a
// Recording per work — attached to the *existing* Album row (matched by
// release-group id). Recordings already on the album are de-duplicated by
// work-number + primary performer, so hand-seeded/imported ones aren't copied.
// Composers not yet in the catalog are created (dates + era from MusicBrainz,
// bio/portrait from Wikipedia).
//
// Usage: tsx scripts/complete-album.ts <release-group-mbid>
//   (defaults to the Kleiber Beethoven 5 & 7 album)
// After running, re-embed:  npm run ai:reindex && npm run ai:rag

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma, type ArtistKind, type CreditRole, type Era } from "@cadence/db";
import { composerSummary } from "./wikipedia";
import { mbGet, getRecording, type MbArtist, type MbRecording } from "../import/musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_RG = "1c71037d-a648-3093-ba2e-f3c0f00e520a"; // Kleiber — Beethoven 5 & 7
const CAA_CACHE = path.resolve(__dirname, "../import/.cache-caa");
const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- helpers ----------------------------------------------------------------
function slugify(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
const normalize = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
function invertName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}
function yearOf(date?: string): number | null {
  const m = date?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}
function eraFromYear(y: number | null): Era {
  if (!y) return "MODERN";
  if (y < 1400) return "MEDIEVAL";
  if (y < 1600) return "RENAISSANCE";
  if (y < 1740) return "BAROQUE";
  if (y < 1810) return "CLASSICAL";
  if (y < 1880) return "ROMANTIC";
  if (y < 1910) return "LATE_ROMANTIC";
  if (y < 1960) return "MODERN";
  return "CONTEMPORARY";
}
function artistKind(a: MbArtist): ArtistKind {
  return a.type === "Group" || a.type === "Orchestra" || a.type === "Choir" ? "ENSEMBLE" : "PERSON";
}

// Language-agnostic identity for a work: genre + number (so "Symphony No. 5" and
// "Symphony no. 5 in C minor, op. 67" collide for dedup).
function workKey(title: string): string {
  const t = normalize(title);
  const genre = t.match(
    /\b(symphony|symphonie|concerto|sonata|quartet|quintet|trio|overture|suite|mass|requiem|nocturne|prelude|fugue|variations|serenade|rhapsody|ballade|etude|waltz|mazurka)\b/,
  )?.[1];
  const num = t.match(/\b(?:no\.?|nr\.?|n°|op\.?)\s*(\d+)/)?.[1];
  return genre && num ? `${genre.replace("symphonie", "symphony")} ${num}` : slugify(title);
}
function performerKey(credits: { role: CreditRole; artist: { name: string } }[]): string {
  const c =
    credits.find((x) => x.role === "CONDUCTOR") ?? credits.find((x) => x.role === "SOLOIST") ?? credits[0];
  return c ? (normalize(c.artist.name).split(/\s+/).pop() ?? "") : "";
}

function extractCredits(r: MbRecording): { artist: MbArtist; kind: ArtistKind; role: CreditRole }[] {
  const out: { artist: MbArtist; kind: ArtistKind; role: CreditRole }[] = [];
  const seen = new Set<string>();
  const add = (artist: MbArtist, role: CreditRole, kind: ArtistKind) => {
    const key = `${artist.id}:${role}`;
    if (!artist.id || seen.has(key)) return;
    seen.add(key);
    out.push({ artist, kind, role });
  };
  for (const rel of r.relations ?? []) {
    if (!rel.artist) continue;
    const t = rel.type.toLowerCase();
    if (t === "conductor") add(rel.artist, "CONDUCTOR", "PERSON");
    else if (t.includes("orchestra")) add(rel.artist, "ENSEMBLE", "ENSEMBLE");
    else if (t === "performer" || t === "instrument" || t === "vocal")
      add(rel.artist, rel.attributes?.length ? "SOLOIST" : "PERFORMER", artistKind(rel.artist));
  }
  if (out.length === 0) {
    for (const ac of r["artist-credit"] ?? []) {
      if (!ac.artist) continue;
      const kind = artistKind(ac.artist);
      add(ac.artist, kind === "ENSEMBLE" ? "ENSEMBLE" : "PERFORMER", kind);
    }
  }
  return out.slice(0, 6);
}

async function upsertArtist(a: MbArtist, kind: ArtistKind) {
  return prisma.artist.upsert({
    where: { musicbrainzId: a.id },
    update: {},
    create: { slug: `${slugify(a.name)}-${a.id.slice(0, 6)}`, name: a.name, kind, musicbrainzId: a.id },
  });
}

async function coverArt(rgId: string): Promise<string | null> {
  const file = path.join(CAA_CACHE, `release-group-${rgId}.json`);
  let data: { images?: { front?: boolean; image?: string; thumbnails?: Record<string, string> }[] } | null;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    data = raw === "null" ? null : JSON.parse(raw);
  } else {
    try {
      const res = await fetch(`https://coverartarchive.org/release-group/${rgId}`, { headers: { "User-Agent": USER_AGENT } });
      data = res.ok ? await res.json() : null;
    } catch {
      data = null;
    }
    fs.mkdirSync(CAA_CACHE, { recursive: true });
    fs.writeFileSync(file, data ? JSON.stringify(data) : "null");
    await sleep(250);
  }
  if (!data?.images?.length) return null;
  const front = data.images.find((i) => i.front) ?? data.images[0];
  return front.thumbnails?.["500"] ?? front.thumbnails?.large ?? front.image ?? null;
}

// Find an existing composer (by MB id or slug) or create one from MB + Wikipedia.
async function getOrCreateComposer(mb: { name: string; id: string }, log: string[]) {
  const existing = await prisma.composer.findFirst({
    where: { OR: [{ musicbrainzId: mb.id }, { slug: slugify(mb.name) }] },
  });
  if (existing) return existing;

  let artist: { "sort-name"?: string; "life-span"?: { begin?: string; end?: string }; area?: { name?: string }; country?: string } | null = null;
  try {
    artist = await mbGet(`/artist/${mb.id}`);
  } catch {
    artist = null;
  }
  const birthYear = yearOf(artist?.["life-span"]?.begin);
  const wiki = await composerSummary(mb.name);
  const composer = await prisma.composer.create({
    data: {
      slug: slugify(mb.name),
      name: mb.name,
      sortName: artist?.["sort-name"] ?? invertName(mb.name),
      era: eraFromYear(birthYear),
      birthYear,
      deathYear: yearOf(artist?.["life-span"]?.end),
      nationality: artist?.area?.name ?? artist?.country ?? null,
      bio: wiki?.extract ?? null,
      imageUrl: wiki?.thumbnail ?? null,
      musicbrainzId: mb.id,
    },
  });
  log.push(`created composer: ${composer.name} (${composer.era})`);
  return composer;
}

// --- MusicBrainz shapes -----------------------------------------------------
type MbTrack = { title: string; recording: MbRecording & { relations?: { type: string; work?: { id: string; title: string } }[] } };
type MbReleaseFull = { id: string; date?: string; media?: { tracks?: MbTrack[]; "track-count"?: number }[] };

async function pickRelease(rgId: string): Promise<string | null> {
  const data = await mbGet<{ releases?: MbReleaseFull[] }>(`/release?release-group=${rgId}&limit=25&inc=media`);
  let best: string | null = null;
  let bestTracks = -1;
  for (const rel of data.releases ?? []) {
    const tracks = (rel.media ?? []).reduce((s, m) => s + (m["track-count"] ?? 0), 0);
    if (tracks > bestTracks) {
      bestTracks = tracks;
      best = rel.id;
    }
  }
  return best;
}

// Resolve a performance work → its parent work + composer (memoized across albums).
const workInfoCache = new Map<string, { parent: { id: string; title: string }; composer: { name: string; id: string } | null }>();
async function workInfo(workId: string) {
  const hit = workInfoCache.get(workId);
  if (hit) return hit;
  const w = await mbGet<{
    title: string;
    relations?: { type: string; direction?: string; work?: { id: string; title: string }; artist?: { id: string; name: string } }[];
  }>(`/work/${workId}?inc=work-rels+artist-rels`);
  let parent = { id: workId, title: w.title };
  let composer: { name: string; id: string } | null = null;
  for (const r of w.relations ?? []) {
    if (r.type === "parts" && r.direction === "backward" && r.work) parent = { id: r.work.id, title: r.work.title };
    if (r.type === "composer" && r.artist) composer = { name: r.artist.name, id: r.artist.id };
  }
  const info = { parent, composer };
  workInfoCache.set(workId, info);
  return info;
}

export type CompleteResult = {
  album: string;
  added: number;
  dupes: number;
  noComposer: number;
  createdComposers: number;
  log: string[];
};

/** Complete one album (by release-group id). Returns stats; throws on hard errors. */
export async function completeAlbum(rgId: string): Promise<CompleteResult | null> {
  const log: string[] = [];
  const album = await prisma.album.findUnique({ where: { musicbrainzId: rgId } });
  if (!album) return null;

  const existing = await prisma.recording.findMany({
    where: { albumId: album.id },
    include: { work: true, credits: { include: { artist: true } } },
  });
  const existingKeys = new Set(existing.map((r) => `${workKey(r.work.title)}|${performerKey(r.credits)}`));

  const relId = await pickRelease(rgId);
  if (!relId) return { album: album.title, added: 0, dupes: 0, noComposer: 0, createdComposers: 0, log };
  const rel = await mbGet<MbReleaseFull>(`/release/${relId}?inc=recordings+recording-level-rels+work-rels+artist-credits`);
  const albumYear = album.year ?? yearOf(rel.date);

  // Group tracks by their resolved parent work.
  const groups = new Map<string, { title: string; composer: { name: string; id: string } | null; recIds: string[] }>();
  for (const media of rel.media ?? []) {
    for (const t of media.tracks ?? []) {
      const perf = t.recording.relations?.find((r) => r.type === "performance" && r.work)?.work;
      if (!perf) continue;
      const info = await workInfo(perf.id);
      const g = groups.get(info.parent.id) ?? { title: info.parent.title, composer: info.composer, recIds: [] };
      g.recIds.push(t.recording.id);
      groups.set(info.parent.id, g);
    }
  }

  if (!album.imageUrl) {
    const cover = await coverArt(rgId);
    if (cover) await prisma.album.update({ where: { id: album.id }, data: { imageUrl: cover } });
  }

  let added = 0;
  let dupes = 0;
  let noComposer = 0;
  let createdComposers = 0;

  for (const [parentId, group] of groups) {
    if (!group.composer) {
      noComposer++;
      continue;
    }
    const before = await prisma.composer.count({ where: { musicbrainzId: group.composer.id } });
    const dbComposer = await getOrCreateComposer(group.composer, log);
    if (before === 0 && dbComposer.musicbrainzId === group.composer.id) createdComposers++;

    const rec0 = await getRecording(group.recIds[0]);
    const credits = extractCredits(rec0);
    const dedupKey = `${workKey(group.title)}|${performerKey(credits)}`;
    if (existingKeys.has(dedupKey)) {
      dupes++;
      continue;
    }
    existingKeys.add(dedupKey);

    const work = await prisma.work.upsert({
      where: { musicbrainzId: parentId },
      update: {},
      create: {
        slug: `${dbComposer.slug}--${slugify(group.title)}-${parentId.slice(0, 6)}`,
        composerId: dbComposer.id,
        title: group.title,
        musicbrainzId: parentId,
      },
    });
    const primary =
      credits.find((c) => c.role === "CONDUCTOR")?.artist.name ??
      credits.find((c) => c.role === "SOLOIST")?.artist.name ??
      credits[0]?.artist.name ??
      "performance";
    const recMbid = group.recIds[0];
    const recording = await prisma.recording.upsert({
      where: { musicbrainzId: recMbid },
      update: { albumId: album.id },
      create: {
        slug: `${work.slug}--${slugify(primary)}-${recMbid.slice(0, 6)}`,
        workId: work.id,
        albumId: album.id,
        year: albumYear,
        tradition: "OTHER",
        musicbrainzId: recMbid,
      },
    });
    for (const c of credits) {
      const artist = await upsertArtist(c.artist, c.kind);
      await prisma.recordingCredit.upsert({
        where: { recordingId_artistId_role: { recordingId: recording.id, artistId: artist.id, role: c.role } },
        update: {},
        create: { recordingId: recording.id, artistId: artist.id, role: c.role },
      });
    }
    added++;
    log.push(`+ ${dbComposer.name} — ${work.title} (${primary})`);
  }

  return { album: album.title, added, dupes, noComposer, createdComposers, log };
}

async function main() {
  const rgId = process.argv[2] || DEFAULT_RG;
  const res = await completeAlbum(rgId);
  if (!res) {
    console.error(`No album with release-group ${rgId} in the catalog.`);
    return;
  }
  console.log(`Completing album: ${res.album}`);
  res.log.forEach((l) => console.log(`  ${l}`));
  console.log(`\nDone: +${res.added} recording(s), ${res.dupes} already present, ${res.noComposer} no-composer, ${res.createdComposers} new composer(s).`);
  if (res.added > 0) console.log("Re-embed: npm run ai:reindex && npm run ai:rag");
}

if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
