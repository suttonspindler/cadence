// Album-completion importer (v1).
//
// Given an album's MusicBrainz release-group id, pull a representative release's
// full tracklist, collapse movement tracks into their parent works, and create a
// Recording per work — attached to the *existing* Album row (matched by
// release-group id). Recordings that already sit on the album (e.g. hand-seeded
// ones) are de-duplicated by work-number + primary performer, so we don't create
// a second copy.
//
// v1 scope: single- or multi-work albums whose tracks are whole works or
// movement-of-work (symphonies, concertos, sonatas). Composers must already
// exist in the catalog — unknown composers are reported and skipped, not
// invented. Widen later for operas / multi-composer recitals / new composers.
//
// Usage: tsx scripts/complete-album.ts <release-group-mbid>
//   (defaults to the Kleiber Beethoven 5 & 7 album for the demo)
// After running, re-embed:  npm run ai:reindex && npm run ai:rag

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma, type ArtistKind, type CreditRole } from "@cadence/db";
import { mbGet, getRecording, type MbArtist, type MbRecording } from "../import/musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_RG = "1c71037d-a648-3093-ba2e-f3c0f00e520a"; // Kleiber — Beethoven 5 & 7
const CAA_CACHE = path.resolve(__dirname, "../import/.cache-caa");
const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- small helpers (mirrors import.ts) -------------------------------------
function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
const normalize = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
function yearOf(date?: string): number | null {
  const m = date?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}
function artistKind(a: MbArtist): ArtistKind {
  return a.type === "Group" || a.type === "Orchestra" || a.type === "Choir" ? "ENSEMBLE" : "PERSON";
}

// Language-agnostic identity for a work: genre + number (so English "Symphony
// No. 5" and MusicBrainz "Symphony no. 5 in C minor, op. 67" collide).
function workKey(title: string): string {
  const t = normalize(title);
  const genre = t.match(
    /\b(symphony|symphonie|concerto|sonata|quartet|quintet|trio|overture|suite|mass|requiem|nocturne|prelude|fugue|variations|serenade|rhapsody|ballade|etude|waltz|mazurka)\b/,
  )?.[1];
  const num = t.match(/\b(?:no\.?|nr\.?|n°|op\.?)\s*(\d+)/)?.[1];
  return genre && num ? `${genre.replace("symphonie", "symphony")} ${num}` : slugify(title);
}

// Surname of the billed performer (conductor > soloist > first), for dedup.
function performerKey(credits: { role: CreditRole; artist: { name: string } }[]): string {
  const c =
    credits.find((x) => x.role === "CONDUCTOR") ??
    credits.find((x) => x.role === "SOLOIST") ??
    credits[0];
  if (!c) return "";
  return normalize(c.artist.name).split(/\s+/).pop() ?? "";
}

// Strip a trailing "…: <movement>" so movement tracks of one work group together.
function parentTitleGuess(title: string): string {
  const idx = title.search(/:\s+(?:[IVXLC]+\.|No\.?\s|Nr\.?\s|\d+\.|Act\b|Akt\b|Scene\b|Aria\b)/i);
  return idx > 0 ? title.slice(0, idx).trim() : title;
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
      const res = await fetch(`https://coverartarchive.org/release-group/${rgId}`, {
        headers: { "User-Agent": USER_AGENT },
      });
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

// --- MusicBrainz shapes we touch -------------------------------------------
type MbTrack = { title: string; recording: MbRecording & { relations?: { type: string; work?: { id: string; title: string } }[] } };
type MbReleaseFull = { id: string; date?: string; media?: { tracks?: MbTrack[]; "track-count"?: number }[] };

/** Pick the release in the group with the most tracks (most complete edition). */
async function pickRelease(rgId: string): Promise<string | null> {
  const data = await mbGet<{ releases?: MbReleaseFull[] }>(
    `/release?release-group=${rgId}&limit=25&inc=media`,
  );
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

/** Resolve a performance work to its parent work + composer. */
async function workInfo(workId: string): Promise<{
  parent: { id: string; title: string };
  composer: { name: string; id: string } | null;
}> {
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
  return { parent, composer };
}

async function main() {
  const rgId = process.argv[2] || DEFAULT_RG;

  const album = await prisma.album.findUnique({ where: { musicbrainzId: rgId } });
  if (!album) {
    console.error(`No album with release-group ${rgId} in the catalog. v1 completes existing albums.`);
    return;
  }
  console.log(`Completing album: ${album.title}`);

  // Existing recordings on the album → dedup keys.
  const existing = await prisma.recording.findMany({
    where: { albumId: album.id },
    include: { work: true, credits: { include: { artist: true } } },
  });
  const existingKeys = new Set(
    existing.map((r) => `${workKey(r.work.title)}|${performerKey(r.credits)}`),
  );
  console.log(`  already on album: ${existing.map((r) => r.work.title).join(", ") || "(none)"}`);

  const relId = await pickRelease(rgId);
  if (!relId) {
    console.error("  no releases found in this release group.");
    return;
  }
  const rel = await mbGet<MbReleaseFull>(
    `/release/${relId}?inc=recordings+recording-level-rels+work-rels+artist-credits`,
  );
  const albumYear = album.year ?? yearOf(rel.date);

  // Group tracks by parent-work guess.
  const groups = new Map<string, { workId: string; recIds: string[] }>();
  let noWork = 0;
  for (const media of rel.media ?? []) {
    for (const t of media.tracks ?? []) {
      const perf = t.recording.relations?.find((r) => r.type === "performance" && r.work)?.work;
      if (!perf) {
        noWork++;
        continue;
      }
      const key = parentTitleGuess(perf.title);
      if (!groups.has(key)) groups.set(key, { workId: perf.id, recIds: [] });
      groups.get(key)!.recIds.push(t.recording.id);
    }
  }
  if (noWork) console.log(`  ${noWork} track(s) had no linked work — skipped.`);

  // Refresh the album cover if missing.
  if (!album.imageUrl) {
    const cover = await coverArt(rgId);
    if (cover) await prisma.album.update({ where: { id: album.id }, data: { imageUrl: cover } });
  }

  let added = 0;
  let dupes = 0;
  let skippedComposer = 0;

  for (const [, group] of groups) {
    const info = await workInfo(group.workId);
    if (!info.composer) {
      console.log(`  ? ${info.parent.title}: no composer relation — skipped`);
      continue;
    }
    const dbComposer = await prisma.composer.findFirst({
      where: { OR: [{ musicbrainzId: info.composer.id }, { slug: slugify(info.composer.name) }] },
    });
    if (!dbComposer) {
      console.log(`  ⤬ ${info.parent.title}: composer "${info.composer.name}" not in catalog — skipped`);
      skippedComposer++;
      continue;
    }

    // Credits from the first movement's recording (they're identical across movements).
    const rec0 = await getRecording(group.recIds[0]);
    const credits = extractCredits(rec0);
    const dedupKey = `${workKey(info.parent.title)}|${performerKey(credits)}`;
    if (existingKeys.has(dedupKey)) {
      console.log(`  = ${info.parent.title}: already on album — skipped (dedup)`);
      dupes++;
      continue;
    }
    existingKeys.add(dedupKey);

    const work = await prisma.work.upsert({
      where: { musicbrainzId: info.parent.id },
      update: {},
      create: {
        slug: `${dbComposer.slug}--${slugify(info.parent.title)}-${info.parent.id.slice(0, 6)}`,
        composerId: dbComposer.id,
        title: info.parent.title,
        musicbrainzId: info.parent.id,
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
        where: {
          recordingId_artistId_role: { recordingId: recording.id, artistId: artist.id, role: c.role },
        },
        update: {},
        create: { recordingId: recording.id, artistId: artist.id, role: c.role },
      });
    }
    added++;
    console.log(`  + ${dbComposer.name} — ${work.title}  (${primary})`);
  }

  console.log(
    `\nDone: +${added} recording(s), ${dupes} already present, ${skippedComposer} skipped (composer not in catalog).`,
  );
  if (added > 0) console.log("Re-embed to index the new recordings: npm run ai:reindex && npm run ai:rag");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
