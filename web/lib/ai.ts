// Server-side client for the Python AI service. Distinguishes three outcomes so
// the UI can show an accurate message: results, a transient rate-limit
// (Voyage 429 -> service 503), or the service being unreachable/down.

const AI_BASE = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export type RecordingHit = {
  slug: string;
  year: number | null;
  tradition: string;
  work: string;
  work_slug: string;
  composer: string;
  composer_slug: string;
  performers: string | null;
  score: number | null;
};

export type AiOutcome =
  | { status: "ok"; results: RecordingHit[] }
  | { status: "rate_limited" }
  | { status: "unavailable" };

async function getOutcome(path: string): Promise<AiOutcome> {
  try {
    const res = await fetch(`${AI_BASE}${path}`, { cache: "no-store" });
    // The service returns 503 when the embedding provider is rate-limited.
    if (res.status === 503 || res.status === 429) return { status: "rate_limited" };
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as { results?: RecordingHit[] };
    return { status: "ok", results: data.results ?? [] };
  } catch {
    return { status: "unavailable" }; // connection refused / not running
  }
}

/** Full outcome — use where the UI needs to explain failures (search page). */
export function searchRecordings(query: string, limit = 12): Promise<AiOutcome> {
  return getOutcome(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

/** Convenience: results or null — for places that just hide the section on failure. */
async function resultsOrNull(path: string): Promise<RecordingHit[] | null> {
  const outcome = await getOutcome(path);
  return outcome.status === "ok" ? outcome.results : null;
}

export function similarRecordings(recordingId: string, limit = 6) {
  return resultsOrNull(`/recordings/${recordingId}/similar?limit=${limit}`);
}

export function recommendationsForUser(userId: string, limit = 8) {
  return resultsOrNull(`/users/${userId}/recommendations?limit=${limit}`);
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${AI_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type Citation = { title: string; url: string | null; cited_text: string };

export type AssistantAnswer = {
  question: string;
  answer: string | null;
  citations: Citation[];
  sources_used?: number;
  retrieved?: string[];
  error: string | null; // null | "llm_not_configured" | "no_context" | "llm_error: ..."
};

/** Ask the RAG assistant. Returns null only if the AI service is unreachable. */
export function askAssistant(question: string) {
  return getJson<AssistantAnswer>(`/assistant?q=${encodeURIComponent(question)}`);
}

export type ReviewSummary = {
  summary: string | null;
  count: number;
  error: string | null; // null | "not_enough_reviews" | "llm_not_configured" | "llm_error: ..."
};

export function reviewSummary(recordingId: string) {
  return getJson<ReviewSummary>(`/recordings/${recordingId}/review-summary`);
}
