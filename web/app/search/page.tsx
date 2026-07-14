import { searchRecordings } from "@/lib/ai";
import { RecordingHitList } from "@/components/RecordingHitList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

const EXAMPLES = [
  "dramatic Romantic symphonies with intense first movements",
  "intimate period-instrument Baroque",
  "clear, structural solo piano",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const outcome = query ? await searchRecordings(query) : null;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Discover</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Describe what you want to hear in your own words — mood, era, style, forces — and Cadence
        finds recordings by meaning, not just keywords.
      </p>

      <form action="/search" method="get" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="e.g. brooding late-Romantic symphony with a tender slow movement"
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper-raised px-4 py-3 outline-none focus:border-accent-soft"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-5 py-3 font-medium text-paper-raised transition hover:bg-accent-soft"
        >
          Search
        </button>
      </form>

      {!query && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="text-ink-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <a
              key={ex}
              href={`/search?q=${encodeURIComponent(ex)}`}
              className="rounded-full border border-line px-3 py-1 text-ink-soft transition hover:border-accent-soft"
            >
              {ex}
            </a>
          ))}
        </div>
      )}

      {query && outcome && (
        <section className="mt-8">
          {outcome.status === "rate_limited" ? (
            <p className="rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-soft">
              The embedding service is busy right now. Wait a few seconds and search again.
            </p>
          ) : outcome.status === "unavailable" ? (
            <p className="rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-soft">
              Search is unavailable — the AI service isn&apos;t reachable. Start it with{" "}
              <code>npm run ai:dev</code>.
            </p>
          ) : outcome.results.length === 0 ? (
            <p className="text-ink-soft">No matches for “{query}”.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-faint">
                {outcome.results.length} {outcome.results.length === 1 ? "result" : "results"} for
                “{query}”
              </p>
              <RecordingHitList hits={outcome.results} showScore />
            </>
          )}
        </section>
      )}
    </div>
  );
}
