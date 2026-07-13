// A labeled 1–5 rating selector built from native radio inputs, so it works in a
// server-action form with no client JavaScript. `current` pre-selects a value.
export function RatingInput({
  name,
  label,
  current,
}: {
  name: string;
  label: string;
  current?: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-soft">{label}</span>
      <fieldset className="flex gap-1.5" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" title={`${n}`}>
            <input
              type="radio"
              name={name}
              value={n}
              defaultChecked={current === n}
              className="peer sr-only"
            />
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm transition hover:border-accent-soft peer-checked:border-accent peer-checked:bg-accent peer-checked:text-paper-raised">
              {n}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
