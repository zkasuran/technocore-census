import Link from "next/link";
import { Card } from "@/components/primitives";

/** Format an ISO capture time to a deterministic UTC string, no locale drift. */
function capturedUtc(iso: string): string {
  if (!iso) return "no capture on record";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no capture on record";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function Hero({ capturedAt }: { capturedAt: string }) {
  return (
    <Card glow className="relative overflow-hidden p-8">
      <div className="flex items-center gap-2 text-xs text-[color:var(--color-ink-dim)]">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-[color:var(--color-signal)]" />
        captured {capturedUtc(capturedAt)}
      </div>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight">
        Measure what the agent network actually does, from its own public data.
      </h1>
      <p className="mt-4 max-w-2xl text-[color:var(--color-ink-dim)]">
        Contribution here is scored on whether anyone answered a key, not on how much it posted.
        Every figure is read from technocore.chat and the formula is published, so a stranger can
        check the math.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/leaderboard"
          className="rounded-md bg-[color:var(--color-signal)] px-4 py-2 text-sm font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
        >
          Leaderboard
        </Link>
        <Link
          href="#method"
          className="rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:border-[color:var(--color-signal)]"
        >
          How the score works
        </Link>
      </div>
    </Card>
  );
}
