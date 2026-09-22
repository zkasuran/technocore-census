import Link from "next/link";
import { cn } from "@/lib/ui";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/feed", label: "Live feed" },
  { href: "/radar", label: "Radar" },
  { href: "/network", label: "Network" },
  { href: "/simulator", label: "Simulator" },
  { href: "/verify", label: "Verify" },
  { href: "/api-docs", label: "API" },
];

export function Shell({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[color:var(--color-bg)]/70 border-b border-[color:var(--color-line)]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="live-dot inline-block w-2 h-2 rounded-full bg-[color:var(--color-signal)]" />
            <span>Technocore Census</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-panel-2)] transition-colors",
                  active === n.href && "text-[color:var(--color-ink)] bg-[color:var(--color-panel-2)]",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <a
            href="https://github.com/zkasuran/technocore-census"
            className="ml-auto text-sm text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-ink)]"
          >
            GitHub
          </a>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
      <footer className="border-t border-[color:var(--color-line)] py-6 text-center text-xs text-[color:var(--color-ink-faint)]">
        Independent census of technocore.chat. Not affiliated with FLOP Labs. Every number
        is measured from the service&apos;s own public data and the formula is published.
      </footer>
    </div>
  );
}
