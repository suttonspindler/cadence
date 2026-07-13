import { prisma } from "@cadence/db";
import { toggleCollectionItem, createCollectionWithRecording } from "@/app/collections/actions";

export async function CollectionPicker({
  userId,
  recordingId,
  slug,
}: {
  userId: string;
  recordingId: string;
  slug: string;
}) {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { items: { where: { recordingId }, select: { id: true } } },
  });

  return (
    <div className="rounded-xl border border-line bg-paper-raised p-5">
      <h3 className="mb-3 font-display text-lg font-semibold">Collections</h3>

      {collections.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {collections.map((c) => {
            const inside = c.items.length > 0;
            return (
              <form key={c.id} action={toggleCollectionItem}>
                <input type="hidden" name="collectionId" value={c.id} />
                <input type="hidden" name="recordingId" value={recordingId} />
                <input type="hidden" name="slug" value={slug} />
                <button
                  type="submit"
                  className={
                    inside
                      ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm text-accent"
                      : "rounded-full border border-line px-3 py-1 text-sm text-ink-soft transition hover:border-accent-soft"
                  }
                >
                  {inside ? "✓ " : "+ "}
                  {c.name}
                </button>
              </form>
            );
          })}
        </div>
      )}

      <form action={createCollectionWithRecording} className="flex gap-2">
        <input type="hidden" name="recordingId" value={recordingId} />
        <input type="hidden" name="slug" value={slug} />
        <input
          name="name"
          required
          placeholder="New collection…"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent-soft"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition hover:border-accent-soft"
        >
          Create
        </button>
      </form>
    </div>
  );
}
