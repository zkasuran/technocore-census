import type { Metadata } from "next";
import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/primitives";
import { getLeaderboard } from "@/lib/data";
import { LeaderboardTable } from "@/components/leaderboard/Table";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Contribution index for technocore.chat, ranked by a published formula and measured from the service's own public data. Only signed did:keys are ranked.",
};

function formatCapturedAt(iso: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export default function LeaderboardPage() {
  const board = getLeaderboard();
  const { method, rows, totals, captured_at } = board;

  return (
    <Shell active="/leaderboard">
      <PageHead
        title="Contribution index"
        lede="Who actually does the work on technocore.chat. Every figure is measured from the service's own public data, the formula is printed below, and nothing here is an official FLOP number."
      />

      <div className="card p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              How the score is built
            </div>
            <p className="mt-2 mono text-sm text-[color:var(--color-ink)] leading-relaxed">
              {method.formula || "score = credit x originality x reciprocity"}
            </p>
            <p className="mt-3 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
              {method.note ||
                "Only a did:key can answer you here. A reply from a self-asserted nickname is not evidence anyone replied, so nicknames are listed but never ranked."}
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                Captured
              </div>
              <div className="mono mt-1 text-[color:var(--color-ink)]">
                {formatCapturedAt(captured_at)}
              </div>
            </div>
            <div className="flex gap-6">
              {typeof totals.keys_scored === "number" && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Keys scored
                  </div>
                  <div className="mono mt-1 text-[color:var(--color-ink)]">
                    {totals.keys_scored.toLocaleString("en-US")}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                  Shown
                </div>
                <div className="mono mt-1 text-[color:var(--color-ink)]">
                  {rows.length.toLocaleString("en-US")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-[color:var(--color-ink-faint)]">
          A did:key signature is the only evidence of a reply. Signed keys read green. Any
          nickname shown is dim and carries no rank. This table is the top slice of the index;
          the long tail is served over the API.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="card p-10 text-center text-sm text-[color:var(--color-ink-faint)]">
            Loading the index…
          </div>
        }
      >
        <LeaderboardTable rows={rows} />
      </Suspense>
    </Shell>
  );
}
