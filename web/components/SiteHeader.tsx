"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/auth-actions";

type SessionUser = { name?: string | null; email?: string | null } | null;

const NAV_LINKS = [
  { href: "/search", label: "Discover" },
  { href: "/ask", label: "Ask" },
  { href: "/composers", label: "Composers" },
  { href: "/albums", label: "Albums" },
  { href: "/recordings", label: "Recordings" },
];

// Account menu — everything personal, kept out of the main browse nav.
const ACCOUNT_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/collections", label: "Collections" },
  { href: "/reviews", label: "Your reviews" },
  { href: "/listening", label: "Listening history" },
  { href: "/settings", label: "Settings" },
];

export function SiteHeader({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false); // mobile menu
  const [menuOpen, setMenuOpen] = useState(false); // account dropdown
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);
  const closeMenu = () => setMenuOpen(false);
  const displayName = user?.name ?? user?.email ?? null;
  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  // Close the account dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        <nav className="hidden items-center gap-5 text-sm text-ink-soft md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-accent">
              {l.label}
            </Link>
          ))}
          <form action="/find" method="get" role="search">
            <input
              name="q"
              type="search"
              placeholder="Search…"
              aria-label="Search the catalog"
              className="w-36 rounded-full border border-line bg-paper px-3.5 py-1.5 text-sm text-ink outline-none transition focus:w-52 focus:border-accent-soft lg:w-40"
            />
          </form>
          {user ? (
            <div
              ref={menuRef}
              className="relative"
              onMouseEnter={() => setMenuOpen(true)}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-ink-soft transition hover:text-accent"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-display font-semibold text-paper-raised">
                  {initial}
                </span>
                <span className="hidden max-w-[10rem] truncate lg:inline">{displayName}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={menuOpen ? "rotate-180 transition" : "transition"}>
                  <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                // Panel touches the button (top-full) with the visual gap as
                // transparent padding inside the hover area — no dead zone
                // between trigger and menu that would fire onMouseLeave.
                <div className="absolute right-0 top-full z-50 w-52 pt-2">
                  <div
                    role="menu"
                    className="overflow-hidden rounded-lg border border-line bg-paper-raised py-1 shadow-lg shadow-black/5"
                  >
                    {ACCOUNT_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        role="menuitem"
                        onClick={closeMenu}
                        className="block px-4 py-2 text-sm text-ink-soft transition hover:bg-paper hover:text-accent"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="block w-full px-4 py-2 text-left text-sm text-ink-soft transition hover:bg-paper hover:text-accent"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              )}
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
            <form action="/find" method="get" role="search" onSubmit={close} className="py-3">
              <input
                name="q"
                type="search"
                placeholder="Search the catalog…"
                aria-label="Search the catalog"
                className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-accent-soft"
              />
            </form>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="border-b border-line/60 py-3 text-ink-soft hover:text-accent"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <div className="px-0 pb-1 pt-4 text-xs uppercase tracking-widest text-ink-faint">
                  {displayName}
                </div>
                {ACCOUNT_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={close}
                    className="border-b border-line/60 py-3 text-ink-soft hover:text-accent"
                  >
                    {l.label}
                  </Link>
                ))}
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
