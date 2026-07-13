// Curated seed dataset for Cadence.
//
// Hand-authored, demo-quality classical catalog spanning Baroque → Modern, with
// multiple contrasting recordings per marquee work (e.g. a historically-informed
// reading vs. a Romantic-tradition one) so that semantic search and the
// recommendation engine have real signal to work with later.
//
// Idempotent: clears the catalog + user-generated tables, then re-inserts.
// Embeddings are intentionally left null — the Python AI service backfills them.

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, Era, PerformanceTradition, ArtistKind, CreditRole } from "@prisma/client";

// Load the repo-root .env (seed runs from packages/db via tsx).
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

type CreditSpec = { artist: string; role: CreditRole };
type RecordingSpec = {
  slug: string;
  year?: number;
  label?: string;
  tradition: PerformanceTradition;
  notes?: string;
  credits: CreditSpec[];
};
type WorkSpec = {
  slug: string;
  title: string;
  catalogNumber?: string;
  key?: string;
  genre?: string;
  composedYear?: number;
  description?: string;
  movements?: { position: number; title: string; tempoMarking?: string }[];
  recordings: RecordingSpec[];
};
type ComposerSpec = {
  slug: string;
  name: string;
  sortName: string;
  birthYear?: number;
  deathYear?: number;
  era: Era;
  nationality?: string;
  bio?: string;
  works: WorkSpec[];
};

// --- Artists (people + ensembles) ------------------------------------------
const artists: { slug: string; name: string; kind: ArtistKind; instrument?: string }[] = [
  { slug: "fabio-biondi", name: "Fabio Biondi", kind: ArtistKind.PERSON, instrument: "violin" },
  { slug: "europa-galante", name: "Europa Galante", kind: ArtistKind.ENSEMBLE },
  { slug: "itzhak-perlman", name: "Itzhak Perlman", kind: ArtistKind.PERSON, instrument: "violin" },
  { slug: "london-philharmonic", name: "London Philharmonic Orchestra", kind: ArtistKind.ENSEMBLE },
  { slug: "glenn-gould", name: "Glenn Gould", kind: ArtistKind.PERSON, instrument: "piano" },
  { slug: "andras-schiff", name: "András Schiff", kind: ArtistKind.PERSON, instrument: "piano" },
  { slug: "pablo-casals", name: "Pablo Casals", kind: ArtistKind.PERSON, instrument: "cello" },
  { slug: "yo-yo-ma", name: "Yo-Yo Ma", kind: ArtistKind.PERSON, instrument: "cello" },
  { slug: "carlos-kleiber", name: "Carlos Kleiber", kind: ArtistKind.PERSON },
  { slug: "vienna-philharmonic", name: "Vienna Philharmonic", kind: ArtistKind.ENSEMBLE },
  { slug: "roger-norrington", name: "Roger Norrington", kind: ArtistKind.PERSON },
  { slug: "london-classical-players", name: "London Classical Players", kind: ArtistKind.ENSEMBLE },
  { slug: "karl-bohm", name: "Karl Böhm", kind: ArtistKind.PERSON },
  { slug: "berlin-philharmonic", name: "Berlin Philharmonic", kind: ArtistKind.ENSEMBLE },
  { slug: "christopher-hogwood", name: "Christopher Hogwood", kind: ArtistKind.PERSON },
  { slug: "academy-of-ancient-music", name: "Academy of Ancient Music", kind: ArtistKind.ENSEMBLE },
  { slug: "leonard-bernstein", name: "Leonard Bernstein", kind: ArtistKind.PERSON },
  { slug: "yevgeny-mravinsky", name: "Yevgeny Mravinsky", kind: ArtistKind.PERSON },
  { slug: "leningrad-philharmonic", name: "Leningrad Philharmonic", kind: ArtistKind.ENSEMBLE },
];

// --- Catalog ----------------------------------------------------------------
const composers: ComposerSpec[] = [
  {
    slug: "antonio-vivaldi",
    name: "Antonio Vivaldi",
    sortName: "Vivaldi, Antonio",
    birthYear: 1678,
    deathYear: 1741,
    era: Era.BAROQUE,
    nationality: "Italian",
    bio: "Venetian priest and virtuoso violinist whose concertos defined the Baroque solo concerto.",
    works: [
      {
        slug: "the-four-seasons",
        title: "The Four Seasons",
        catalogNumber: "Op. 8, Nos. 1–4",
        genre: "Concerto",
        composedYear: 1723,
        description:
          "Four violin concertos, each a musical depiction of a season, among the most recorded works in the repertoire.",
        movements: [
          { position: 1, title: "Spring (La primavera): Allegro", tempoMarking: "Allegro" },
          { position: 2, title: "Spring (La primavera): Largo e pianissimo sempre", tempoMarking: "Largo" },
          { position: 3, title: "Spring (La primavera): Allegro (Danza pastorale)", tempoMarking: "Allegro" },
        ],
        recordings: [
          {
            slug: "four-seasons-biondi-europa-galante",
            year: 2000,
            label: "Naïve",
            tradition: PerformanceTradition.HISTORICALLY_INFORMED,
            notes: "Fiery period-instrument reading with brisk tempos and vivid ornamentation.",
            credits: [
              { artist: "fabio-biondi", role: CreditRole.SOLOIST },
              { artist: "europa-galante", role: CreditRole.ENSEMBLE },
            ],
          },
          {
            slug: "four-seasons-perlman-lpo",
            year: 1976,
            label: "EMI",
            tradition: PerformanceTradition.ROMANTIC,
            notes: "Warm, lyrical, large-ensemble account in the mid-century Romantic tradition.",
            credits: [
              { artist: "itzhak-perlman", role: CreditRole.SOLOIST },
              { artist: "london-philharmonic", role: CreditRole.ENSEMBLE },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "johann-sebastian-bach",
    name: "Johann Sebastian Bach",
    sortName: "Bach, Johann Sebastian",
    birthYear: 1685,
    deathYear: 1750,
    era: Era.BAROQUE,
    nationality: "German",
    bio: "Composer and organist whose contrapuntal mastery is a cornerstone of Western music.",
    works: [
      {
        slug: "goldberg-variations",
        title: "Goldberg Variations",
        catalogNumber: "BWV 988",
        key: "G major",
        genre: "Keyboard variations",
        composedYear: 1741,
        description: "An aria with thirty variations, celebrated for its architecture and contrapuntal ingenuity.",
        recordings: [
          {
            slug: "goldberg-gould-1955",
            year: 1955,
            label: "Columbia",
            tradition: PerformanceTradition.MODERN,
            notes: "Gould's electrifying debut recording — fast, clear, and structurally revelatory.",
            credits: [{ artist: "glenn-gould", role: CreditRole.SOLOIST }],
          },
          {
            slug: "goldberg-gould-1981",
            year: 1981,
            label: "CBS",
            tradition: PerformanceTradition.MODERN,
            notes: "Gould's contemplative re-recording, slower and more inward than 1955.",
            credits: [{ artist: "glenn-gould", role: CreditRole.SOLOIST }],
          },
          {
            slug: "goldberg-schiff-ecm",
            year: 2001,
            label: "ECM",
            tradition: PerformanceTradition.MODERN,
            notes: "Schiff's lucid, singing account with a similar structural focus on modern piano.",
            credits: [{ artist: "andras-schiff", role: CreditRole.SOLOIST }],
          },
        ],
      },
      {
        slug: "cello-suite-no-1",
        title: "Cello Suite No. 1",
        catalogNumber: "BWV 1007",
        key: "G major",
        genre: "Suite",
        composedYear: 1720,
        description: "The first of six suites for unaccompanied cello, opening with its famous Prélude.",
        movements: [
          { position: 1, title: "Prélude", tempoMarking: "—" },
          { position: 2, title: "Allemande" },
          { position: 3, title: "Courante" },
        ],
        recordings: [
          {
            slug: "cello-suite-1-casals",
            year: 1939,
            label: "EMI",
            tradition: PerformanceTradition.ROMANTIC,
            notes: "Casals's historic recordings that reintroduced the suites to the repertoire.",
            credits: [{ artist: "pablo-casals", role: CreditRole.SOLOIST }],
          },
          {
            slug: "cello-suite-1-yoyoma",
            year: 1983,
            label: "CBS",
            tradition: PerformanceTradition.MODERN,
            notes: "Yo-Yo Ma's flowing, tonally rich first traversal.",
            credits: [{ artist: "yo-yo-ma", role: CreditRole.SOLOIST }],
          },
        ],
      },
    ],
  },
  {
    slug: "ludwig-van-beethoven",
    name: "Ludwig van Beethoven",
    sortName: "Beethoven, Ludwig van",
    birthYear: 1770,
    deathYear: 1827,
    era: Era.CLASSICAL,
    nationality: "German",
    bio: "Bridged the Classical and Romantic eras; his symphonies redefined the form.",
    works: [
      {
        slug: "symphony-no-5",
        title: "Symphony No. 5",
        catalogNumber: "Op. 67",
        key: "C minor",
        genre: "Symphony",
        composedYear: 1808,
        description: "The 'fate' symphony, opening with the most famous four-note motif in music.",
        movements: [
          { position: 1, title: "Allegro con brio", tempoMarking: "Allegro con brio" },
          { position: 2, title: "Andante con moto", tempoMarking: "Andante con moto" },
          { position: 3, title: "Scherzo: Allegro", tempoMarking: "Allegro" },
          { position: 4, title: "Allegro", tempoMarking: "Allegro" },
        ],
        recordings: [
          {
            slug: "beethoven-5-kleiber-vpo",
            year: 1974,
            label: "Deutsche Grammophon",
            tradition: PerformanceTradition.TRADITIONAL,
            notes: "Often cited as the greatest recording of the work — taut, propulsive, incandescent.",
            credits: [
              { artist: "carlos-kleiber", role: CreditRole.CONDUCTOR },
              { artist: "vienna-philharmonic", role: CreditRole.ENSEMBLE },
            ],
          },
          {
            slug: "beethoven-5-norrington",
            year: 1988,
            label: "EMI",
            tradition: PerformanceTradition.HISTORICALLY_INFORMED,
            notes: "Period instruments and Beethoven's fast metronome marks — lean and driving.",
            credits: [
              { artist: "roger-norrington", role: CreditRole.CONDUCTOR },
              { artist: "london-classical-players", role: CreditRole.ENSEMBLE },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "wolfgang-amadeus-mozart",
    name: "Wolfgang Amadeus Mozart",
    sortName: "Mozart, Wolfgang Amadeus",
    birthYear: 1756,
    deathYear: 1791,
    era: Era.CLASSICAL,
    nationality: "Austrian",
    bio: "Prolific Classical-era master of opera, symphony, concerto, and chamber music.",
    works: [
      {
        slug: "symphony-no-40",
        title: "Symphony No. 40",
        catalogNumber: "K. 550",
        key: "G minor",
        genre: "Symphony",
        composedYear: 1788,
        description: "One of only two Mozart symphonies in a minor key, urgent and chromatic.",
        recordings: [
          {
            slug: "mozart-40-bohm-bpo",
            year: 1962,
            label: "Deutsche Grammophon",
            tradition: PerformanceTradition.TRADITIONAL,
            notes: "Böhm's warm, weighty, big-orchestra Mozart.",
            credits: [
              { artist: "karl-bohm", role: CreditRole.CONDUCTOR },
              { artist: "berlin-philharmonic", role: CreditRole.ENSEMBLE },
            ],
          },
          {
            slug: "mozart-40-hogwood-aam",
            year: 1984,
            label: "L'Oiseau-Lyre",
            tradition: PerformanceTradition.PERIOD_INSTRUMENT,
            notes: "Transparent period-instrument reading with smaller forces and quicker tempos.",
            credits: [
              { artist: "christopher-hogwood", role: CreditRole.CONDUCTOR },
              { artist: "academy-of-ancient-music", role: CreditRole.ENSEMBLE },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "gustav-mahler",
    name: "Gustav Mahler",
    sortName: "Mahler, Gustav",
    birthYear: 1860,
    deathYear: 1911,
    era: Era.LATE_ROMANTIC,
    nationality: "Austrian",
    bio: "Late-Romantic symphonist and conductor whose vast symphonies stretch the form to its limits.",
    works: [
      {
        slug: "symphony-no-5",
        title: "Symphony No. 5",
        key: "C-sharp minor",
        genre: "Symphony",
        composedYear: 1902,
        description: "Opens with a funeral march and closes in triumph; contains the celebrated Adagietto.",
        movements: [
          { position: 1, title: "Trauermarsch", tempoMarking: "In gemessenem Schritt" },
          { position: 4, title: "Adagietto", tempoMarking: "Sehr langsam" },
        ],
        recordings: [
          {
            slug: "mahler-5-bernstein-vpo",
            year: 1987,
            label: "Deutsche Grammophon",
            tradition: PerformanceTradition.ROMANTIC,
            notes: "Bernstein's intensely expressive, emotionally maximal account.",
            credits: [
              { artist: "leonard-bernstein", role: CreditRole.CONDUCTOR },
              { artist: "vienna-philharmonic", role: CreditRole.ENSEMBLE },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "dmitri-shostakovich",
    name: "Dmitri Shostakovich",
    sortName: "Shostakovich, Dmitri",
    birthYear: 1906,
    deathYear: 1975,
    era: Era.MODERN,
    nationality: "Russian",
    bio: "Soviet composer whose symphonies balance public grandeur with private irony.",
    works: [
      {
        slug: "symphony-no-5",
        title: "Symphony No. 5",
        catalogNumber: "Op. 47",
        key: "D minor",
        genre: "Symphony",
        composedYear: 1937,
        description: "Written under political pressure; its ambiguous triumphant finale is endlessly debated.",
        recordings: [
          {
            slug: "shostakovich-5-mravinsky",
            year: 1954,
            label: "Melodiya",
            tradition: PerformanceTradition.TRADITIONAL,
            notes: "The dedicatee's orchestra under Mravinsky — searing, authoritative, and driven.",
            credits: [
              { artist: "yevgeny-mravinsky", role: CreditRole.CONDUCTOR },
              { artist: "leningrad-philharmonic", role: CreditRole.ENSEMBLE },
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  console.log("Clearing existing data…");
  // Delete in dependency order.
  await prisma.collectionItem.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.listen.deleteMany();
  await prisma.review.deleteMany();
  await prisma.recordingCredit.deleteMany();
  await prisma.ragChunk.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.work.deleteMany();
  await prisma.composer.deleteMany();
  await prisma.artist.deleteMany();

  console.log("Seeding artists…");
  const artistIdBySlug = new Map<string, string>();
  for (const a of artists) {
    const created = await prisma.artist.create({
      data: { slug: a.slug, name: a.name, kind: a.kind, instrument: a.instrument },
    });
    artistIdBySlug.set(a.slug, created.id);
  }

  console.log("Seeding catalog…");
  let workCount = 0;
  let recordingCount = 0;
  for (const c of composers) {
    const composer = await prisma.composer.create({
      data: {
        slug: c.slug,
        name: c.name,
        sortName: c.sortName,
        birthYear: c.birthYear,
        deathYear: c.deathYear,
        era: c.era,
        nationality: c.nationality,
        bio: c.bio,
      },
    });

    for (const w of c.works) {
      // Work slugs must be globally unique; namespace by composer.
      const workSlug = `${c.slug}--${w.slug}`;
      const work = await prisma.work.create({
        data: {
          slug: workSlug,
          composerId: composer.id,
          title: w.title,
          catalogNumber: w.catalogNumber,
          key: w.key,
          genre: w.genre,
          composedYear: w.composedYear,
          description: w.description,
          movements: w.movements
            ? {
                create: w.movements.map((m) => ({
                  position: m.position,
                  title: m.title,
                  tempoMarking: m.tempoMarking,
                })),
              }
            : undefined,
        },
      });
      workCount++;

      for (const r of w.recordings) {
        await prisma.recording.create({
          data: {
            slug: r.slug,
            workId: work.id,
            year: r.year,
            label: r.label,
            tradition: r.tradition,
            notes: r.notes,
            credits: {
              create: r.credits.map((cr) => {
                const artistId = artistIdBySlug.get(cr.artist);
                if (!artistId) throw new Error(`Unknown artist slug in seed: ${cr.artist}`);
                return { artistId, role: cr.role };
              }),
            },
          },
        });
        recordingCount++;
      }
    }
  }

  console.log(
    `Done. Seeded ${composers.length} composers, ${workCount} works, ${recordingCount} recordings, ${artists.length} artists.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
