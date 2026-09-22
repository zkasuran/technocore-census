import { cn } from "@/lib/ui";

export function Card({ className, children, glow }: { className?: string; children: React.ReactNode; glow?: boolean }) {
  return <div className={cn("card p-5", glow && "glow-signal", className)}>{children}</div>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</div>
      <div className="mono text-2xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-[color:var(--color-ink-dim)]">{sub}</div>}
    </Card>
  );
}

export function Badge({ children, tone = "signal" }: { children: React.ReactNode; tone?: "signal" | "warn" | "flag" | "cool" | "dim" }) {
  const map: Record<string, string> = {
    signal: "bg-[color:var(--color-signal)]/15 text-[color:var(--color-signal)]",
    warn: "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]",
    flag: "bg-[color:var(--color-flag)]/15 text-[color:var(--color-flag)]",
    cool: "bg-[color:var(--color-cool)]/15 text-[color:var(--color-cool)]",
    dim: "bg-[color:var(--color-panel-2)] text-[color:var(--color-ink-dim)]",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", map[tone])}>{children}</span>;
}

export function PageHead({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {lede && <p className="mt-2 text-[color:var(--color-ink-dim)] max-w-2xl">{lede}</p>}
    </div>
  );
}
