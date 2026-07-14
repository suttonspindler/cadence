import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@cadence/db";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";

async function getAlbum(slug: string) {
  return prisma.album.findUnique({
    where: { slug },
    include: {
      recordings: {
        orderBy: [{ work: { composer: { sortName: "asc" } } }, { work: { title: "asc" } }],
        include: {
          work: { include: { composer: true } },
          credits: { include: { artist: true } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbum(slug);
  return { title: album?.title ?? "Album" };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) notFound();

  return (
    <div>
      <Link href="/albums" className="text-sm text-accent hover:underline">
        ← Albums
      </Link>

      <header className="mt-4 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
        <CoverArt title={album.title} imageUrl={album.imageUrl} size={160} />
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Album</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{album.title}</h1>
          <p className="mt-2 text-sm text-ink-faint">
            {[album.label, album.year].filter(Boolean).join(" · ")}
            {(album.label || album.year) && " · "}
            {album.recordings.length}{" "}
            {album.recordings.length === 1 ? "work" : "works"}
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-2xl font-semibold">On this album</h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {album.recordings.map((r) => (
            <li key={r.id} className="px-5 py-3">
              <span className="block">
                <Link
                  href={`/composers/${r.work.composer.slug}`}
                  className="font-medium hover:text-accent"
                >
                  {r.work.composer.name}
                </Link>
                <span className="text-ink-soft"> — </span>
                <Link href={`/recordings/${r.slug}`} className="text-ink-soft hover:text-accent">
                  {r.work.title}
                </Link>
              </span>
              <span className="block truncate text-sm text-ink-faint">
                {r.credits.map((cr) => cr.artist.name).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
