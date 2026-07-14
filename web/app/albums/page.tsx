import Link from "next/link";
import { prisma } from "@cadence/db";
import { CoverArt } from "@/components/CoverArt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Albums" };

export default async function AlbumsPage() {
  const albums = await prisma.album.findMany({
    where: { recordings: { some: {} } },
    orderBy: [{ imageUrl: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    include: { _count: { select: { recordings: true } } },
    take: 120,
  });

  return (
    <div>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Albums</h1>
      <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((a) => (
          <li key={a.id}>
            <Link href={`/albums/${a.slug}`} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line transition group-hover:border-accent-soft">
                <CoverArt title={a.title} imageUrl={a.imageUrl} fill />
              </div>
              <div className="mt-2">
                <div className="line-clamp-2 font-medium leading-snug group-hover:text-accent">
                  {a.title}
                </div>
                <div className="mt-0.5 text-sm text-ink-faint">
                  {[a.year, `${a._count.recordings} ${a._count.recordings === 1 ? "work" : "works"}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
