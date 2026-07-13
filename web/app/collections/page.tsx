import Link from "next/link";
import { prisma } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { createCollection } from "@/app/collections/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const user = await getSessionUser();

  if (!user?.id) {
    return (
      <div className="max-w-md">
        <h1 className="mb-3 font-display text-4xl font-semibold tracking-tight">Collections</h1>
        <p className="text-ink-soft">
          <Link href="/signin" className="font-medium text-accent hover:underline">
            Sign in
          </Link>{" "}
          to create collections and group recordings you want to compare or revisit.
        </p>
      </div>
    );
  }

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Your collections</h1>

      <form
        action={createCollection}
        className="mb-8 space-y-3 rounded-xl border border-line bg-paper-raised p-5"
      >
        <h2 className="font-display text-lg font-semibold">New collection</h2>
        <input
          name="name"
          required
          placeholder="e.g. Bach for a rainy afternoon"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent-soft"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="Description (optional)"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent-soft"
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="isPublic" /> Make public
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-paper-raised transition hover:bg-accent-soft"
        >
          Create collection
        </button>
      </form>

      {collections.length === 0 ? (
        <p className="text-ink-soft">No collections yet. Create one above.</p>
      ) : (
        <ul className="grid gap-3">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-line bg-paper-raised px-5 py-4 transition hover:border-accent-soft"
              >
                <span>
                  <span className="font-display text-lg">{c.name}</span>
                  {c.description && (
                    <span className="block text-sm text-ink-faint">{c.description}</span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-sm text-ink-soft">
                  {c.isPublic && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs">
                      Public
                    </span>
                  )}
                  <span className="text-ink-faint">
                    {c._count.items} {c._count.items === 1 ? "recording" : "recordings"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
