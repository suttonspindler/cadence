import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans-geist",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cadence — Classical music discovery",
    template: "%s · Cadence",
  },
  description:
    "Discover, compare, and review classical recordings across composers, works, movements, and interpretations.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geist.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <header className="border-b border-line bg-paper-raised/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold tracking-tight text-accent">
                Cadence
              </span>
              <span className="hidden text-xs uppercase tracking-widest text-ink-faint sm:inline">
                classical discovery
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-ink-soft">
              <Link href="/search" className="hover:text-accent">
                Discover
              </Link>
              <Link href="/ask" className="hover:text-accent">
                Ask
              </Link>
              <Link href="/composers" className="hover:text-accent">
                Composers
              </Link>
              <Link href="/recordings" className="hover:text-accent">
                Recordings
              </Link>
              {session?.user ? (
                <div className="flex items-center gap-5">
                  <Link href="/collections" className="hover:text-accent">
                    Collections
                  </Link>
                  <Link href="/profile" className="text-ink-faint hover:text-accent">
                    {session.user.name ?? session.user.email}
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button type="submit" className="hover:text-accent">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/signin"
                  className="rounded-full bg-accent px-3 py-1.5 text-paper-raised transition hover:bg-accent-soft"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-ink-faint">
            Cadence — an AI-enhanced classical music discovery platform.
          </div>
        </footer>
      </body>
    </html>
  );
}
