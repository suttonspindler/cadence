import Link from "next/link";
import { prisma, type Era, type PerformanceTradition } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { eraLabel, traditionLabel } from "@/lib/format";
import { reviewOverall } from "@/lib/ratings";
import { SignedOutNotice } from "@/components/SignedOutNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your profile" };

function topOf<K extends string>(counts: Map<K, number>): { key: K; count: number } | null {
  let best: { key: K; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

function StatTile({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-paper-raised px-5 py-4 transition hover:border-accent-soft"
    >
      <div className="font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-ink-faint">{label}</div>
    </Link>
  );
}

function TasteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-ink-faint">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <Link href={href} className="text-sm text-accent hover:underline">
        View all →
      </Link>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user?.id) {
    return (
      <SignedOutNotice
        title="Your profile"
        what="see your listening history, reviews, collections, and taste profile"
      />
    );
  }

  const [listens, reviews, collections] = await Promise.all([
    prisma.listen.findMany({
      where: { userId: user.id },
      orderBy: { listenedAt: "desc" },
      include: {
        recording: {
          include: {
            work: { include: { composer: true } },
            credits: { include: { artist: true } },
          },
        },
      },
    }),
    prisma.review.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { recording: { include: { work: { include: { composer: true } } } } },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  // Derive taste from listening history — a precursor to the AI-generated profile.
  const composerCounts = new Map<string, number>();
  const eraCounts = new Map<Era, number>();
  const traditionCounts = new Map<PerformanceTradition, number>();
  const performerCounts = new Map<string, number>();

  for (const l of listens) {
    const composer = l.recording.work.composer;
    composerCounts.set(composer.name, (composerCounts.get(composer.name) ?? 0) + 1);
    eraCounts.set(composer.era, (eraCounts.get(composer.era) ?? 0) + 1);
    traditionCounts.set(
      l.recording.tradition,
      (traditionCounts.get(l.recording.tradition) ?? 0) + 1,
    );
    for (const cr of l.recording.credits) {
      performerCounts.set(cr.artist.name, (performerCounts.get(cr.artist.name) ?? 0) + 1);
    }
  }

  const topComposer = topOf(composerCounts);
  const topEra = topOf(eraCounts);
  const topTradition = topOf(traditionCounts);
  const topPerformer = topOf(performerCounts);

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4 border-b border-line pb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-display font-semibold text-paper-raised">
          {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {user.name ?? "Your profile"}
          </h1>
          {user.email && <p className="text-sm text-ink-faint">{user.email}</p>}
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatTile value={listens.length} label="Listened" href="/listening" />
        <StatTile value={reviews.length} label="Reviews" href="/reviews" />
        <StatTile value={collections.length} label="Collections" href="/collections" />
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold">Your taste</h2>
        {listens.length === 0 ? (
          <p className="text-ink-soft">
            Mark recordings as listened and your taste profile will build here.
          </p>
        ) : (
          <div className="rounded-xl border border-line bg-paper-raised px-5 py-2">
            {topComposer && (
              <TasteRow label="Favorite composer" value={`${topComposer.key} (${topComposer.count})`} />
            )}
            {topEra && <TasteRow label="Preferred era" value={eraLabel(topEra.key)} />}
            {topTradition && (
              <TasteRow label="Favorite tradition" value={traditionLabel(topTradition.key)} />
            )}
            {topPerformer && (
              <TasteRow label="Most-heard performer" value={`${topPerformer.key} (${topPerformer.count})`} />
            )}
          </div>
        )}
      </section>

      <section>
        <Link
          href="/recommendations"
          className="flex items-center justify-between gap-4 rounded-xl border border-line bg-paper-raised px-5 py-4 transition hover:border-accent-soft"
        >
          <span>
            <span className="font-display text-lg font-semibold">Recommended for you</span>
            <span className="mt-0.5 block text-sm text-ink-faint">
              Recordings near your taste, chosen by meaning.
            </span>
          </span>
          <span className="shrink-0 text-accent">→</span>
        </Link>
      </section>

      <section>
        <SectionHeader title="Recently listened" href="/listening" />
        {listens.length === 0 ? (
          <p className="text-ink-soft">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
            {listens.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/recordings/${l.recording.slug}`}
                  className="block px-5 py-3 transition hover:bg-paper"
                >
                  <span className="font-medium">{l.recording.work.composer.name}</span>
                  <span className="text-ink-soft"> — {l.recording.work.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="Your reviews" href="/reviews" />
        {reviews.length === 0 ? (
          <p className="text-ink-soft">No reviews yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper-raised">
            {reviews.slice(0, 5).map((r) => {
              const overall = reviewOverall(r);
              return (
                <li key={r.id}>
                  <Link
                    href={`/recordings/${r.recording.slug}`}
                    className="flex items-baseline justify-between gap-4 px-5 py-3 transition hover:bg-paper"
                  >
                    <span>
                      <span className="font-medium">{r.recording.work.composer.name}</span>
                      <span className="text-ink-soft"> — {r.recording.work.title}</span>
                    </span>
                    {overall !== null && (
                      <span className="shrink-0 font-display font-semibold">
                        {overall.toFixed(1)}
                        <span className="text-ink-faint"> / 5</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="Collections" href="/collections" />
        {collections.length === 0 ? (
          <p className="text-ink-soft">
            No collections yet.{" "}
            <Link href="/collections" className="text-accent hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-3">
            {collections.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.id}`}
                  className="flex items-baseline justify-between gap-4 rounded-lg border border-line bg-paper-raised px-5 py-3 transition hover:border-accent-soft"
                >
                  <span className="font-display text-lg">{c.name}</span>
                  <span className="text-sm text-ink-faint">
                    {c._count.items} {c._count.items === 1 ? "recording" : "recordings"}
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
