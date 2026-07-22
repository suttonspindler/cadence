import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/SiteHeader";
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
  const user = session?.user
    ? { name: session.user.name, email: session.user.email }
    : null;

  return (
    <html
      lang="en"
      className={`${geist.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <SiteHeader user={user} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-ink-faint">
            Cadence, an AI-enhanced classical music discovery platform.
          </div>
        </footer>
      </body>
    </html>
  );
}
