import { signIn, googleEnabled, devLoginEnabled } from "@/auth";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Sign in to Cadence</h1>
      <p className="mt-3 text-ink-soft">
        Sign in to rate and review recordings, track what you&apos;ve listened to, and build
        collections.
      </p>

      <div className="mt-8 space-y-6">
        {googleEnabled && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3 font-medium transition hover:border-accent-soft hover:shadow-sm"
            >
              Continue with Google
            </button>
          </form>
        )}

        {googleEnabled && devLoginEnabled && (
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        )}

        {devLoginEnabled && (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("dev", {
                email: formData.get("email"),
                name: formData.get("name"),
                redirectTo: "/",
              });
            }}
            className="space-y-3 rounded-lg border border-dashed border-line bg-paper-raised p-4"
          >
            <p className="text-xs uppercase tracking-widest text-ink-faint">Dev login</p>
            <div>
              <label className="mb-1 block text-sm text-ink-soft" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                defaultValue="Dev User"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent-soft"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-soft" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="dev@cadence.local"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent-soft"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-paper-raised transition hover:bg-accent-soft"
            >
              Continue
            </button>
          </form>
        )}

        {!googleEnabled && !devLoginEnabled && (
          <p className="rounded-lg border border-line bg-paper-raised p-4 text-sm text-ink-soft">
            No sign-in methods are configured. Set <code>AUTH_GOOGLE_ID</code>/
            <code>AUTH_GOOGLE_SECRET</code> or <code>ENABLE_DEV_LOGIN=true</code> in your{" "}
            <code>.env</code>.
          </p>
        )}
      </div>
    </div>
  );
}
