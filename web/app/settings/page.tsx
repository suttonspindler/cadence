import { prisma } from "@cadence/db";
import { getSessionUser } from "@/lib/session";
import { updateDisplayName } from "@/lib/profile-actions";
import { SignedOutNotice } from "@/components/SignedOutNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const PROVIDER_LABELS: Record<string, string> = { google: "Google" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user?.id) {
    return <SignedOutNotice title="Settings" what="manage your account" />;
  }

  const account = await prisma.account.findFirst({
    where: { userId: user.id },
    select: { provider: true },
  });
  const signInMethod = account
    ? (PROVIDER_LABELS[account.provider] ?? account.provider)
    : "Email (dev login)";

  return (
    <div className="max-w-xl">
      <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Settings</h1>

      <section className="rounded-xl border border-line bg-paper-raised p-6">
        <h2 className="font-display text-xl font-semibold">Display name</h2>
        <p className="mt-1 text-sm text-ink-faint">Shown on your reviews and profile.</p>
        <form action={updateDisplayName} className="mt-4 flex gap-2">
          <input
            name="name"
            defaultValue={user.name ?? ""}
            maxLength={80}
            required
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-4 py-2.5 outline-none focus:border-accent-soft"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-5 py-2.5 font-medium text-paper-raised transition hover:bg-accent-soft"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-paper-raised p-6">
        <h2 className="font-display text-xl font-semibold">Account</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-faint">Email</dt>
            <dd className="font-medium">{user.email ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-ink-faint">Sign-in method</dt>
            <dd className="font-medium">{signInMethod}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
