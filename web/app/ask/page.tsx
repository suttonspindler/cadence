import Link from "next/link";
import { askAssistant } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask" };

const EXAMPLES = [
  "What's the difference between historically-informed and traditional recordings?",
  "Why are there two Glenn Gould recordings of the Goldberg Variations?",
  "What makes Vivaldi's Four Seasons so widely recorded?",
];

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const question = (q ?? "").trim();
  const result = question ? await askAssistant(question) : null;

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Ask Cadence</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Ask about composers, works, performance traditions, or how recordings differ. Answers are
        grounded in Cadence&apos;s catalog and cite their sources.
      </p>

      <form action="/ask" method="get" className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={question}
          autoFocus
          placeholder="e.g. How does a period-instrument Beethoven 5 differ from a traditional one?"
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper-raised px-4 py-3 outline-none focus:border-accent-soft"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-5 py-3 font-medium text-paper-raised transition hover:bg-accent-soft"
        >
          Ask
        </button>
      </form>

      {!question && (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <span className="text-ink-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <a
              key={ex}
              href={`/ask?q=${encodeURIComponent(ex)}`}
              className="text-accent hover:underline"
            >
              {ex}
            </a>
          ))}
        </div>
      )}

      {question && <AnswerBlock result={result} />}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-soft">
      {children}
    </div>
  );
}

function AnswerBlock({
  result,
}: {
  result: Awaited<ReturnType<typeof askAssistant>>;
}) {
  if (result === null) {
    return (
      <Notice>
        The assistant is unavailable — the AI service isn&apos;t reachable. Start it with{" "}
        <code>npm run ai:dev</code>.
      </Notice>
    );
  }
  if (result.error === "no_context") {
    return (
      <Notice>
        The knowledge base is empty. Build it with <code>npm run ai:rag</code>.
      </Notice>
    );
  }
  if (result.error === "llm_not_configured") {
    return (
      <Notice>
        <p>
          The assistant needs an Anthropic API key to generate answers. Add{" "}
          <code>ANTHROPIC_API_KEY</code> to <code>.env</code> and restart the AI service.
        </p>
        {result.retrieved && result.retrieved.length > 0 && (
          <p className="mt-3 text-ink-faint">
            Retrieval is working — it found {result.retrieved.length} relevant sources:{" "}
            {result.retrieved.join("; ")}.
          </p>
        )}
      </Notice>
    );
  }
  if (result.error) {
    return <Notice>The assistant hit an error: {result.error}</Notice>;
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-line bg-paper-raised p-6">
        <p className="whitespace-pre-wrap leading-relaxed">{result.answer}</p>
      </div>

      {result.citations.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Sources</h2>
          <ul className="space-y-2">
            {result.citations.map((c, i) => (
              <li key={i} className="rounded-lg border border-line bg-paper-raised px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  {c.url ? (
                    <Link href={c.url} className="font-medium text-accent hover:underline">
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{c.title}</span>
                  )}
                </div>
                {c.cited_text && (
                  <p className="mt-1 text-sm italic text-ink-faint">“{c.cited_text}”</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
