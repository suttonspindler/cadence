import Link from "next/link";

/** Standard signed-out fallback for account pages. */
export function SignedOutNotice({ title, what }: { title: string; what: string }) {
  return (
    <div className="max-w-md">
      <h1 className="mb-3 font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="text-ink-soft">
        <Link href="/signin" className="font-medium text-accent hover:underline">
          Sign in
        </Link>{" "}
        to {what}.
      </p>
    </div>
  );
}
