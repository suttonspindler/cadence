// Reusable Wikipedia enrichment helper (used by the enrichment script now and by
// the MusicBrainz importer later). One call returns both a prose extract and a
// portrait/thumbnail, so callers can populate bio + imageUrl together.

const USER_AGENT =
  "CadenceBot/0.1 (classical music portfolio project; spindler.s@northeastern.edu)";

export type WikiSummary = { extract: string | null; thumbnail: string | null };

export async function wikipediaSummary(title: string): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data: {
      type?: string;
      extract?: string;
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
    } = await res.json();
    // Disambiguation pages aren't real content — skip them.
    if (data.type === "disambiguation") return null;
    return {
      extract: data.extract?.trim() || null,
      thumbnail: data.thumbnail?.source ?? data.originalimage?.source ?? null,
    };
  } catch {
    return null;
  }
}

/** Composer-aware lookup: prefer the "(composer)" disambiguation page so names
 *  that collide with a more famous person (e.g. "John Adams" the US president)
 *  resolve to the composer. Falls back to the bare name. */
export async function composerSummary(name: string): Promise<WikiSummary | null> {
  for (const title of [`${name} (composer)`, name]) {
    const s = await wikipediaSummary(title);
    if (s?.extract) return s;
  }
  return null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
