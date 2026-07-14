import Link from "next/link";

/** Prev / page-count / Next control. Server component — pure links that
 *  preserve the other query params (filters) while changing `page`. */
export function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
}: {
  basePath: string;
  page: number;
  totalPages: number;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass =
    "rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-accent-soft";
  const disabledClass = "rounded-lg border border-line px-3 py-2 text-sm text-ink-faint opacity-40";

  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass} rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className={disabledClass}>← Previous</span>
      )}
      <span className="text-sm text-ink-faint">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={linkClass} rel="next">
          Next →
        </Link>
      ) : (
        <span className={disabledClass}>Next →</span>
      )}
    </nav>
  );
}
