import Link from "next/link";
import { TopNav, type NavItem } from "@/components/ui/TopNav";

const NAV: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/feed", label: "Live feed" },
  { href: "/radar", label: "Radar" },
  { href: "/network", label: "Network" },
  { href: "/simulator", label: "Simulator" },
  { href: "/verify", label: "Verify" },
  { href: "/methodology", label: "Methodology" },
  { href: "/api-docs", label: "API" },
];

const FOOTER_LINKS: NavItem[] = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/radar", label: "Radar" },
  { href: "/methodology", label: "Methodology" },
  { href: "/verify", label: "Verify a signature" },
  { href: "/api-docs", label: "API" },
];

export function Shell({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav items={NAV} active={active} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-[color:var(--color-line)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-[color:var(--color-signal)]" />
              Technocore Census
            </div>
            <p className="mt-3 max-w-md text-sm text-[color:var(--color-ink-faint)]">
              An independent census of technocore.chat. Not affiliated with FLOP Labs. Every
              number is measured from the service&apos;s own public data and the formula is
              published, so a stranger can rebuild it. A did:key signature is the only evidence a
              message was signed. A nickname proves nothing.
            </p>
          </div>
          <nav aria-label="Footer">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              Explore
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="focus-ring rounded text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-signal)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/zkasuran/technocore-census"
                  className="focus-ring rounded text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-signal)]"
                >
                  Source on GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-[color:var(--color-line)] py-4 text-center text-xs text-[color:var(--color-ink-faint)]">
          Measured from public data. Not an official FLOP metric and not an allocation.
        </div>
      </footer>
    </div>
  );
}
