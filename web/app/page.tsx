import Link from "next/link";
import { prisma } from "@cadence/db";
import { composerDates, eraLabel, traditionLabel } from "@/lib/format";
import { Portrait } from "@/components/Portrait";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

// A recognizable starter set to feature on the home page; the full list lives at
// /composers. (No play-count data yet, so this is curated rather than computed.)
const FEATURED_SLUGS = [
  "johann-sebastian-bach",
  "wolfgang-amadeus-mozart",
  "ludwig-van-beethoven",
  "frederic-chopin",
  "pyotr-ilyich-tchaikovsky",
  "antonio-vivaldi",
];

export default async function HomePage() {
  const [featuredComposers, recordings, composerCount, workCount, recordingCount] =
    await Promise.all([
      prisma.composer.findMany({
        where: { slug: { in: FEATURED_SLUGS } },
        include: { _count: { select: { works: true } } },
      }),
    prisma.recording.findMany({
      take: 6,
      orderBy: { createdAt: "asc" },
      include: {
        work: { include: { composer: true } },
        credits: { include: { artist: true } },
      },
    }),
    prisma.composer.count({ where: { works: { some: {} } } }),
    prisma.work.count(),
    prisma.recording.count(),
  ]);

  // Preserve the curated featured order.
  const composers = FEATURED_SLUGS.map((slug) =>
    featuredComposers.find((c) => c.slug === slug),
  ).filter((c): c is (typeof featuredComposers)[number] => Boolean(c));

  return (
    <div className="space-y-16">
      <section className="max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-widest text-accent">
          Classical music discovery
        </p>
        <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight">
          One work. Many interpretations.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          The same piece exists in dozens of recordings — different performers, ensembles,
          conductors, and traditions. Cadence organizes them so you can explore, compare, and
          understand the world of classical performance.
        </p>
        <div className="mt-6 flex gap-8 text-sm text-ink-faint">
          <span>
            <strong className="font-display text-lg text-ink">{composerCount}</strong> composers
          </span>
          <span>
            <strong className="font-display text-lg text-ink">{workCount}</strong> works
          </span>
          <span>
            <strong className="font-display text-lg text-ink">{recordingCount}</strong> recordings
          </span>
        </div>
      </section>

      <section>
        <Link
          href="/composers"
          className="group mb-5 inline-flex items-baseline gap-1.5 hover:text-accent"
        >
          <h2 className="font-display text-2xl font-semibold">Composers</h2>
          <span className="text-accent transition group-hover:translate-x-0.5">›</span>
          <span className="ml-1 text-sm text-ink-faint">all {composerCount}</span>
        </Link>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {composers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/composers/${c.slug}`}
                className="flex h-full min-h-[88px] items-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3 transition hover:border-accent-soft hover:shadow-sm"
              >
                <Portrait name={c.name} imageUrl={c.imageUrl} size={48} />
                <span className="min-w-0">
                  <span className="block font-display text-lg leading-snug line-clamp-2">
                    {c.name}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-faint">
                    {eraLabel(c.era)} · {composerDates(c.birthYear, c.deathYear)} ·{" "}
                    {c._count.works} {c._count.works === 1 ? "work" : "works"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Link
          href="/recordings"
          className="group mb-5 inline-flex items-baseline gap-1.5 hover:text-accent"
        >
          <h2 className="font-display text-2xl font-semibold">Recently added recordings</h2>
          <span className="text-accent transition group-hover:translate-x-0.5">›</span>
        </Link>
        <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {recordings.map((r) => {
            const performers = r.credits
              .map((cr) => cr.artist.name)
              .slice(0, 2)
              .join(", ");
            return (
              <li key={r.id}>
                <Link
                  href={`/recordings/${r.slug}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-paper"
                >
                  <span className="flex items-center gap-3">
                    <CoverArt title={r.work.title} imageUrl={r.imageUrl} size={44} />
                    <span>
                      <span className="font-medium">{r.work.composer.name}</span>
                      <span className="text-ink-soft"> — {r.work.title}</span>
                      <span className="block text-sm text-ink-faint">
                        {performers}
                        {r.year ? ` · ${r.year}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                    {traditionLabel(r.tradition)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
