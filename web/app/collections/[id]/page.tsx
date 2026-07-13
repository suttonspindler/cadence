import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { traditionLabel } from "@/lib/format";
import { removeFromCollection, deleteCollection } from "@/app/collections/actions";

export const dynamic = "force-dynamic";

async function getCollection(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: { position: "asc" },
        include: {
          recording: {
            include: {
              work: { include: { composer: true } },
              credits: { include: { artist: true } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await getCollection(id);
  return { title: collection?.name ?? "Collection" };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await getCollection(id);
  if (!collection) notFound();

  const user = await getSessionUser();
  const isOwner = user?.id === collection.userId;

  // Private collections are visible only to their owner.
  if (!collection.isPublic && !isOwner) notFound();

  return (
    <div>
      <Link href="/collections" className="text-sm text-accent hover:underline">
        ← Collections
      </Link>

      <header className="mt-4 border-b border-line pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="mt-2 max-w-2xl text-ink-soft">{collection.description}</p>
            )}
            <p className="mt-2 text-sm text-ink-faint">
              {collection.isPublic ? "Public" : "Private"} · by{" "}
              {collection.user.name ?? collection.user.email ?? "a listener"} ·{" "}
              {collection.items.length}{" "}
              {collection.items.length === 1 ? "recording" : "recordings"}
            </p>
          </div>
          {isOwner && (
            <form action={deleteCollection}>
              <input type="hidden" name="collectionId" value={collection.id} />
              <button type="submit" className="text-sm text-ink-faint hover:text-accent">
                Delete
              </button>
            </form>
          )}
        </div>
      </header>

      {collection.items.length === 0 ? (
        <p className="mt-8 text-ink-soft">
          This collection is empty. Add recordings from any recording page.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-lg border border-line bg-paper-raised">
          {collection.items.map((item) => {
            const r = item.recording;
            return (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <Link href={`/recordings/${r.slug}`} className="group min-w-0">
                  <span className="font-medium group-hover:text-accent">
                    {r.work.composer.name}
                  </span>
                  <span className="text-ink-soft"> — {r.work.title}</span>
                  <span className="block truncate text-sm text-ink-faint">
                    {r.credits.map((cr) => cr.artist.name).join(", ")}
                    {r.year ? ` · ${r.year}` : ""} · {traditionLabel(r.tradition)}
                  </span>
                </Link>
                {isOwner && (
                  <form action={removeFromCollection} className="shrink-0">
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="recordingId" value={r.id} />
                    <button type="submit" className="text-sm text-ink-faint hover:text-accent">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
