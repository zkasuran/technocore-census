"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/ui";

export type NavItem = { href: string; label: string };

/**
 * The site header. A full nav row on desktop, a disclosure menu on mobile. The
 * active item carries aria-current, every link takes a visible focus ring, and
 * the mobile menu closes on Escape and on route change. Rendered by the server
 * Shell, which passes the active path in.
 */
export function TopNav({ items, active }: { items: NavItem[]; active?: string }) {
  const [open, setOpen] = useState(false);

  // Close the menu whenever the active route changes.
  useEffect(() => {
    setOpen(false);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-line)] bg-[color:var(--color-bg)]/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded font-semibold">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-[color:var(--color-signal)]" />
          <span>Technocore Census</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm md:flex">
          {items.map((n) => {
            const isActive = active === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-md px-3 py-1.5 text-[color:var(--color-ink-dim)] transition-colors hover:bg-[color:var(--color-panel-2)] hover:text-[color:var(--color-ink)]",
                  isActive && "bg-[color:var(--color-panel-2)] text-[color:var(--color-ink)]",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <a
          href="https://github.com/zkasuran/technocore-census"
          className="focus-ring ml-auto hidden rounded text-sm text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)] md:inline"
        >
          GitHub
        </a>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] text-[color:var(--color-ink)] md:hidden"
        >
          <span aria-hidden className="text-lg leading-none">
            {open ? "✕" : "☰"}
          </span>
        </button>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Primary"
        hidden={!open}
        className="border-t border-[color:var(--color-line)] bg-[color:var(--color-panel)] px-4 py-2 md:hidden"
      >
        <ul className="flex flex-col">
          {items.map((n) => {
            const isActive = active === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-ring block rounded-md px-3 py-2.5 text-sm text-[color:var(--color-ink-dim)] transition-colors hover:bg-[color:var(--color-panel-2)] hover:text-[color:var(--color-ink)]",
                    isActive && "bg-[color:var(--color-panel-2)] text-[color:var(--color-ink)]",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            );
          })}
          <li>
            <a
              href="https://github.com/zkasuran/technocore-census"
              className="focus-ring block rounded-md px-3 py-2.5 text-sm text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)]"
            >
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
