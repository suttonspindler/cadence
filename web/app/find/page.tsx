import Link from "next/link";
import { prisma } from "@cadence/db";
import { composerDates, eraLabel, workSubtitle } from "@/lib/format";
import { Portrait } from "@/components/Portrait";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const PER_GROUP = 8;
const FETCH = 30; // fetch a few extra, then rank and trim to PER_GROUP

// Strict keyword relevance: exact match first, then whole-string prefix, then
// any-word prefix, then a plain substring hit.
function rank(text: string, q: string): number {
  const t = text.toLowerCase();
  const query = q.toLowerCase();
  if (t === query) return 0;
  if (t.startsWith(query)) return 1;
  if (t.split(/[\s,.:]+/).some((w) => w.startsWith(query))) return 2;
  return 3;
}

function ranked<T>(items: T[], key: (i: T) => string, q: string): T[] {
  return [...items]
    .sort((a, b) => rank(key(a), q) - rank(key(b), q) || key(a).localeCompare(key(b)))
    .slice(0, PER_GROUP);
}

function GroupHeader({ title, total }: { title: string; total: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 font-display text-2xl font-semibold">
      {title}
      <span className="text-base font-normal text-ink-faint">{total}</span>
    </h2>
  );
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  if (!query) {
    return (
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Search</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Search the catalog by name — composers, works, albums, and performers. Looking for
          something by mood or style instead?{" "}
          <Link href="/search" className="text-accent hover:underline">
            Try Discover
          </Link>
          .
        </p>
      </div>
    );
  }

  const contains = { contains: query, mode: "insensitive" as const };
  const [composers, works, albums, artists, cComposers, cWorks, cAlbums, cArtists] =
    await Promise.all([
      prisma.composer.findMany({ where: { name: contains }, take: FETCH }),
      prisma.work.findMany({
        where: { title: contains },
        take: FETCH,
        include: { composer: { select: { name: true } }, _count: { select: { recordings: true } } },
      }),
      prisma.album.findMany({
        where: { title: contains, recordings: { some: {} } },
        take: FETCH,
        include: { _count: { select: { recordings: true } } },
      }),
      prisma.artist.findMany({ where: { name: contains }, take: FETCH }),
      prisma.composer.count({ where: { name: contains } }),
      prisma.work.count({ where: { title: contains } }),
      prisma.album.count({ where: { title: contains, recordings: { some: {} } } }),
      prisma.artist.count({ where: { name: contains } }),
    ]);

  const total = cComposers + cWorks + cAlbums + cArtists;

  const topComposers = ranked(composers, (c) => c.name, query);
  const topWorks = ranked(works, (w) => w.title, query);
  const topAlbums = ranked(albums, (a) => a.title, query);
  const topArtists = ranked(artists, (a) => a.name, query);

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Search</h1>
      <p className="mt-2 text-sm text-ink-faint">
        {total} {total === 1 ? "match" : "matches"} for “{query}”
      </p>

      {total === 0 ? (
        <p className="mt-8 text-ink-soft">
          No matches for “{query}”. Try a different spelling, or{" "}
          <Link href="/search" className="text-accent hover:underline">
            describe what you want in Discover
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {topComposers.length > 0 && (
            <section>
              <GroupHeader title="Composers" total={cComposers} />
              <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
                {topComposers.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/composers/${c.slug}`}
                      className="flex items-center gap-4 px-5 py-3 transition hover:bg-paper"
                    >
                      <Portrait name={c.name} imageUrl={c.imageUrl} size={40} />
                      <span>
                        <span className="font-display text-lg">{c.name}</span>
                        <span className="ml-2 text-sm text-ink-faint">
                          {[eraLabel(c.era), composerDates(c.birthYear, c.deathYear)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topWorks.length > 0 && (
            <section>
              <GroupHeader title="Works" total={cWorks} />
              <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
                {topWorks.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/works/${w.slug}`}
                      className="block px-5 py-3 transition hover:bg-paper"
                    >
                      <span className="font-medium">{w.title}</span>
                      <span className="block text-sm text-ink-faint">
                        {[w.composer.name, workSubtitle(w), `${w._count.recordings} recordings`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topAlbums.length > 0 && (
            <section>
              <GroupHeader title="Albums" total={cAlbums} />
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {topAlbums.map((a) => (
                  <li key={a.id}>
                    <Link href={`/albums/${a.slug}`} className="group block">
                      <div className="relative aspect-square overflow-hidden rounded-lg border border-line transition group-hover:border-accent-soft">
                        <CoverArt title={a.title} imageUrl={a.imageUrl} fill />
                      </div>
                      <div className="mt-2 line-clamp-2 font-medium leading-snug group-hover:text-accent">
                        {a.title}
                      </div>
                      <div className="text-sm text-ink-faint">
                        {[a.year, `${a._count.recordings} works`].filter(Boolean).join(" · ")}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topArtists.length > 0 && (
            <section>
              <GroupHeader title="Performers" total={cArtists} />
              <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
                {topArtists.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/artists/${a.slug}`}
                      className="flex items-center gap-4 px-5 py-3 transition hover:bg-paper"
                    >
                      <Portrait name={a.name} imageUrl={a.imageUrl} size={40} />
                      <span>
                        <span className="font-display text-lg">{a.name}</span>
                        {a.kind === "PERSON" && a.instrument && (
                          <span className="ml-2 text-sm text-ink-faint">{a.instrument}</span>
                        )}
                        {a.kind === "ENSEMBLE" && (
                          <span className="ml-2 text-sm text-ink-faint">Ensemble</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
