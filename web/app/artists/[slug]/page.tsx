import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@cadence/db";
import { roleLabel } from "@/lib/format";
import { Portrait } from "@/components/Portrait";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

async function getArtist(slug: string) {
  return prisma.artist.findUnique({
    where: { slug },
    include: {
      credits: {
        include: {
          recording: {
            include: {
              work: { include: { composer: true } },
              album: { select: { imageUrl: true } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  return { title: artist?.name ?? "Artist" };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const kindLabel =
    artist.kind === "ENSEMBLE" ? "Ensemble" : artist.instrument ?? "Performer";

  // De-duplicate recordings (an artist can be credited on a recording once) and
  // sort by composer then work for a stable, browsable list.
  const seen = new Set<string>();
  const recordings = artist.credits
    .filter((c) => {
      if (seen.has(c.recording.id)) return false;
      seen.add(c.recording.id);
      return true;
    })
    .map((c) => ({ role: c.role, ...c.recording }))
    .sort((a, b) =>
      (a.work.composer.sortName + a.work.title).localeCompare(b.work.composer.sortName + b.work.title),
    );

  return (
    <div>
      <Link href="/recordings" className="text-sm text-accent hover:underline">
        ← Recordings
      </Link>

      <header className="mt-4 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
        <Portrait name={artist.name} imageUrl={artist.imageUrl} size={112} />
        <div>
          <div className="mb-2 flex items-center gap-3 text-sm text-ink-faint">
            <span className="rounded-full border border-line px-2 py-0.5 text-xs">{kindLabel}</span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{artist.name}</h1>
          {artist.bio && (
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{artist.bio}</p>
          )}
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-2xl font-semibold">
          Recordings
          <span className="ml-2 text-base font-normal text-ink-faint">{recordings.length}</span>
        </h2>
        {recordings.length === 0 ? (
          <p className="text-ink-soft">No recordings yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
            {recordings.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recordings/${r.slug}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-paper"
                >
                  <span className="flex items-center gap-4">
                    <CoverArt title={r.work.title} imageUrl={r.album?.imageUrl ?? r.imageUrl} size={44} />
                    <span>
                      <span className="font-medium">{r.work.composer.name}</span>
                      <span className="text-ink-soft"> — {r.work.title}</span>
                      {r.year ? <span className="block text-sm text-ink-faint">{r.year}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft">
                    {roleLabel(r.role)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
