import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, type CreditRole } from "@cadence/db";
import { auth } from "@/auth";
import { roleLabel, traditionLabel, workSubtitle } from "@/lib/format";
import { aggregateRating } from "@/lib/ratings";
import { toggleListened } from "@/app/recordings/actions";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewList } from "@/components/ReviewList";
import { CollectionPicker } from "@/components/CollectionPicker";
import { RecordingHitList } from "@/components/RecordingHitList";
import { Portrait } from "@/components/Portrait";
import { CoverArt } from "@/components/CoverArt";
import { similarRecordings, reviewSummary } from "@/lib/ai";

export const dynamic = "force-dynamic";

async function getRecording(slug: string) {
  return prisma.recording.findUnique({
    where: { slug },
    include: {
      work: { include: { composer: true } },
      credits: { include: { artist: true } },
      album: true,
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = await getRecording(slug);
  return { title: rec ? `${rec.work.title} — ${rec.work.composer.name}` : "Recording" };
}

const ROLE_ORDER: CreditRole[] = ["SOLOIST", "PERFORMER", "CONDUCTOR", "ENSEMBLE", "CHOIR"];

export default async function RecordingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = await getRecording(slug);
  if (!rec) notFound();

  const session = await auth();
  const userId = session?.user?.id;

  const [reviews, myListen] = await Promise.all([
    prisma.review.findMany({
      where: { recordingId: rec.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true, image: true } } },
    }),
    userId ? prisma.listen.findFirst({ where: { userId, recordingId: rec.id } }) : null,
  ]);

  const myReview = userId ? (reviews.find((r) => r.userId === userId) ?? null) : null;
  const agg = aggregateRating(reviews);
  const listened = Boolean(myListen);
  const similar = await similarRecordings(rec.id, 6);

  const credits = [...rec.credits].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );

  return (
    <div>
      <Link href={`/works/${rec.work.slug}`} className="text-sm text-accent hover:underline">
        ← {rec.work.title}
      </Link>

      <header className="mt-4 flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
        <CoverArt title={rec.work.title} imageUrl={rec.album?.imageUrl ?? rec.imageUrl} size={128} />
        <div>
        <p className="text-sm text-ink-faint">
          <Link href={`/composers/${rec.work.composer.slug}`} className="hover:text-accent">
            {rec.work.composer.name}
          </Link>{" "}
          · {workSubtitle(rec.work) || "—"}
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          {rec.work.title}
        </h1>

        {rec.album && (
          <p className="mt-2 text-sm text-ink-soft">
            From{" "}
            <Link href={`/albums/${rec.album.slug}`} className="text-accent hover:underline">
              {rec.album.title}
            </Link>
            {rec.album.year ? ` (${rec.album.year})` : ""}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-paper-raised">
            {traditionLabel(rec.tradition)}
          </span>
          {rec.label && (
            <span className="rounded-full border border-line px-3 py-1 text-ink-soft">
              {rec.label}
            </span>
          )}
          {rec.year && (
            <span className="rounded-full border border-line px-3 py-1 text-ink-soft">
              {rec.year}
            </span>
          )}
          {agg.avg !== null && (
            <span className="rounded-full border border-line px-3 py-1 text-ink-soft">
              ★ {agg.avg.toFixed(1)} / 5 · {agg.count}{" "}
              {agg.count === 1 ? "review" : "reviews"}
            </span>
          )}
        </div>

        {/* Mark as listened */}
        <div className="mt-4">
          {userId ? (
            <form action={toggleListened}>
              <input type="hidden" name="recordingId" value={rec.id} />
              <input type="hidden" name="slug" value={rec.slug} />
              <button
                type="submit"
                className={
                  listened
                    ? "rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent"
                    : "rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-medium transition hover:border-accent-soft"
                }
              >
                {listened ? "✓ Listened" : "Mark as listened"}
              </button>
            </form>
          ) : (
            <Link
              href="/signin"
              className="rounded-lg border border-line bg-paper-raised px-4 py-2 text-sm font-medium transition hover:border-accent-soft"
            >
              Sign in to track & review
            </Link>
          )}
        </div>
        </div>
      </header>

      <section className="mt-8 grid gap-8 md:grid-cols-[2fr_3fr]">
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold">Performers</h2>
          <ul className="space-y-3">
            {credits.map((cr) => (
              <li key={cr.id} className="flex items-center gap-3">
                <Portrait name={cr.artist.name} imageUrl={cr.artist.imageUrl} size={40} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{cr.artist.name}</span>
                  <span className="block text-sm text-ink-faint">
                    {roleLabel(cr.role)}
                    {cr.artist.instrument ? ` · ${cr.artist.instrument}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {rec.notes && (
          <div>
            <h2 className="mb-3 font-display text-xl font-semibold">Notes</h2>
            <p className="leading-relaxed text-ink-soft">{rec.notes}</p>
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-line pt-8">
        <h2 className="mb-6 font-display text-2xl font-semibold">Ratings & reviews</h2>

        {/* Streamed in after the page loads so the slow Claude call never blocks navigation. */}
        {reviews.length >= 2 && (
          <Suspense fallback={<SummarySkeleton />}>
            <ReviewSummary recordingId={rec.id} />
          </Suspense>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {userId ? (
              <>
                <CollectionPicker userId={userId} recordingId={rec.id} slug={rec.slug} />
                <ReviewForm recordingId={rec.id} slug={rec.slug} review={myReview} />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-line bg-paper-raised p-5 text-sm text-ink-soft">
                <Link href="/signin" className="font-medium text-accent hover:underline">
                  Sign in
                </Link>{" "}
                to rate this recording across performance, sound, historical authenticity, emotional
                impact, and recommendation.
              </div>
            )}
          </div>

          <div>
            <ReviewList reviews={reviews} currentUserId={userId} />
          </div>
        </div>
      </section>

      {similar && similar.length > 0 && (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="mb-2 font-display text-2xl font-semibold">Similar recordings</h2>
          <p className="mb-5 text-sm text-ink-soft">
            Found by embedding similarity across the catalog.
          </p>
          <RecordingHitList hits={similar} />
        </section>
      )}
    </div>
  );
}

// Streamed separately so the (slow) Claude summarization call doesn't block the
// page. Rendered inside a Suspense boundary with the skeleton below as fallback.
async function ReviewSummary({ recordingId }: { recordingId: string }) {
  const summary = await reviewSummary(recordingId);
  if (!summary?.summary) return null;
  return (
    <div className="mb-6 rounded-xl border border-accent-soft/40 bg-accent/5 p-5">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-accent">
        AI summary of {summary.count} reviews
      </p>
      <p className="leading-relaxed text-ink-soft">{summary.summary}</p>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="mb-6 rounded-xl border border-accent-soft/40 bg-accent/5 p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-accent">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        Summarizing reviews…
      </p>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-accent/10" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-accent/10" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-accent/10" />
      </div>
    </div>
  );
}
