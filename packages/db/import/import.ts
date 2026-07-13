// MusicBrainz catalog importer.
//
// Stage 2a: upsert composers (MusicBrainz dates/nationality + Wikipedia bio/portrait).
// Stage 2b: for NEW composers only (the 6 curated seed composers keep their
//           hand-authored works/recordings), import works -> recordings ->
//           credits, with Cover Art Archive cover images.
//
// Rate-limited + cached (see musicbrainz.ts). Usage:
//   tsx import.ts          # all composers, both stages
//   tsx import.ts 3        # first 3 composers only (for testing)

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma, type ArtistKind, type CreditRole } from "@cadence/db";
import { COMPOSER_LIST } from "./composers";
import { wikipediaSummary } from "../scripts/wikipedia";
import {
  searchComposer,
  worksByComposer,
  workRecordings,
  getRecording,
  type MbArtist,
  type MbRecording,
} from "./musicbrainz";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const WORKS_PER_COMPOSER = 6;
const RECORDINGS_PER_WORK = 3;
const CAA_CACHE = path.resolve(__dirname, ".cache-caa");
const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function invertName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}

function yearOf(date?: string): number | null {
  const m = date?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// MusicBrainz models individual movements/arias/scenes as separate "works".
// Skip those so we import top-level works, not fragments like
// "Hail! Bright Cecilia: III. Hark! Hark!".
function isMovementLike(title: string): boolean {
  return (
    /:\s*[IVXLCDM]+\.?\s/i.test(title) || // ": III. ..."
    /:\s*No\.\s*\d/i.test(title) || //       ": No. 3"
    /:\s*(Act|Scene|Aria|Var(iation)?)\b/i.test(title)
  );
}

async function coverArtUrl(releaseMbid: string): Promise<string | null> {
  const file = path.join(CAA_CACHE, `${releaseMbid}.json`);
  let data: { images?: { front?: boolean; image?: string; thumbnails?: Record<string, string> }[] } | null;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf8");
    data = raw === "null" ? null : JSON.parse(raw);
  } else {
    try {
      const res = await fetch(`https://coverartarchive.org/release/${releaseMbid}`, {
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
  return front.thumbnails?.["500"] ?? front.thumbnails?.large ?? front.thumbnails?.small ?? front.image ?? null;
}

function artistKind(a: MbArtist): ArtistKind {
  return a.type === "Group" || a.type === "Orchestra" || a.type === "Choir" ? "ENSEMBLE" : "PERSON";
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
  // Fall back to the recording's artist credit if no typed relations were present.
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
    create: {
      slug: `${slugify(a.name)}-${a.id.slice(0, 6)}`,
      name: a.name,
      kind,
      musicbrainzId: a.id,
    },
  });
}

async function importComposer(spec: { name: string; era: (typeof COMPOSER_LIST)[number]["era"] }) {
  // Keep the curated display name + slug (stable, familiar English forms) and use
  // MusicBrainz only for dates/nationality/id. Avoids duplicate rows when MB's
  // canonical name differs (e.g. "Fryderyk Chopin" vs "Frédéric Chopin").
  const mb = await searchComposer(spec.name);
  const wiki = await wikipediaSummary(spec.name);
  const slug = slugify(spec.name);

  const base = {
    name: spec.name,
    sortName: mb?.["sort-name"] ?? invertName(spec.name),
    era: spec.era,
    birthYear: yearOf(mb?.["life-span"]?.begin),
    deathYear: yearOf(mb?.["life-span"]?.end),
    nationality: mb?.area?.name ?? mb?.country ?? null,
    musicbrainzId: mb?.id ?? null,
  };
  const update: Record<string, unknown> = { ...base };
  if (wiki?.extract) update.bio = wiki.extract;
  if (wiki?.thumbnail) update.imageUrl = wiki.thumbnail;

  const composer = await prisma.composer.upsert({
    where: { slug },
    update,
    create: { slug, ...base, bio: wiki?.extract ?? null, imageUrl: wiki?.thumbnail ?? null },
  });
  return { composer, mbid: mb?.id ?? null };
}

async function importWorksAndRecordings(
  composer: { id: string; slug: string; name: string },
  mbid: string | null,
) {
  if (!mbid) return { works: 0, recordings: 0, skipped: false };
  // Preserve the curated seed composers, identified by their hand-authored
  // (non-MusicBrainz) works.
  if ((await prisma.work.count({ where: { composerId: composer.id, musicbrainzId: null } })) > 0) {
    return { works: 0, recordings: 0, skipped: true };
  }

  const works = (await worksByComposer(mbid, 100))
    .filter((w) => !isMovementLike(w.title))
    .slice(0, WORKS_PER_COMPOSER);
  let wCount = 0;
  let rCount = 0;

  for (const w of works) {
    const work = await prisma.work.upsert({
      where: { musicbrainzId: w.id },
      update: {},
      create: {
        slug: `${composer.slug}--${slugify(w.title)}-${w.id.slice(0, 6)}`,
        composerId: composer.id,
        title: w.title,
        musicbrainzId: w.id,
      },
    });
    wCount++;

    const stubs = await workRecordings(w.id, RECORDINGS_PER_WORK);
    for (const stub of stubs) {
      const r: MbRecording = await getRecording(stub.id);
      const releaseId = r.releases?.[0]?.id;
      const imageUrl = releaseId ? await coverArtUrl(releaseId) : null;
      const recording = await prisma.recording.upsert({
        where: { musicbrainzId: r.id },
        update: { imageUrl },
        create: {
          slug: `${work.slug}--${slugify(r.title)}-${r.id.slice(0, 6)}`,
          workId: work.id,
          year: yearOf(r["first-release-date"]),
          tradition: "OTHER",
          imageUrl,
          musicbrainzId: r.id,
        },
      });
      for (const c of extractCredits(r)) {
        const artist = await upsertArtist(c.artist, c.kind);
        await prisma.recordingCredit.upsert({
          where: {
            recordingId_artistId_role: {
              recordingId: recording.id,
              artistId: artist.id,
              role: c.role,
            },
          },
          update: {},
          create: { recordingId: recording.id, artistId: artist.id, role: c.role },
        });
      }
      rCount++;
    }
  }
  return { works: wCount, recordings: rCount, skipped: false };
}

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : COMPOSER_LIST.length;
  const list = COMPOSER_LIST.slice(0, limit);
  console.log(`Importing ${list.length} composers…`);

  for (const spec of list) {
    const { composer, mbid } = await importComposer(spec);
    const res = await importWorksAndRecordings(composer, mbid);
    console.log(
      `  ${composer.name} — works +${res.works}, recordings +${res.recordings}${res.skipped ? " (seed kept)" : ""}`,
    );
  }

  const [c, w, r, a] = await Promise.all([
    prisma.composer.count(),
    prisma.work.count(),
    prisma.recording.count(),
    prisma.artist.count(),
  ]);
  console.log(`\nCatalog now: ${c} composers, ${w} works, ${r} recordings, ${a} artists.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
