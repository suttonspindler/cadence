"use client";

import Link from "next/link";
import { useState } from "react";
import { signOutAction } from "@/lib/auth-actions";

type SessionUser = { name?: string | null; email?: string | null } | null;

const NAV_LINKS = [
  { href: "/search", label: "Discover" },
  { href: "/ask", label: "Ask" },
  { href: "/composers", label: "Composers" },
  { href: "/recordings", label: "Recordings" },
];

export function SiteHeader({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const displayName = user?.name ?? user?.email ?? null;

  return (
    <header className="border-b border-line bg-paper-raised/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" onClick={close} className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-accent">
            Cadence
          </span>
          <span className="hidden text-xs uppercase tracking-widest text-ink-faint sm:inline">
            classical discovery
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-ink-soft md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-accent">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/collections" className="hover:text-accent">
                Collections
              </Link>
              <Link href="/profile" className="text-ink-faint hover:text-accent">
                {displayName}
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="hover:text-accent">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-full bg-accent px-3 py-1.5 text-paper-raised transition hover:bg-accent-soft"
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {open ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <nav className="border-t border-line md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col px-6 py-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="border-b border-line/60 py-3 text-ink-soft last:border-0 hover:text-accent"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href="/collections"
                  onClick={close}
                  className="border-b border-line/60 py-3 text-ink-soft hover:text-accent"
                >
                  Collections
                </Link>
                <Link
                  href="/profile"
                  onClick={close}
                  className="border-b border-line/60 py-3 text-ink-soft hover:text-accent"
                >
                  Profile{displayName ? ` (${displayName})` : ""}
                </Link>
                <form action={signOutAction} className="py-3">
                  <button type="submit" className="text-ink-soft hover:text-accent">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/signin"
                onClick={close}
                className="py-3 font-medium text-accent hover:underline"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
