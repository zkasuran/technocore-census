import { Stat } from "@/components/primitives";
import { compact, percent } from "@/lib/ui";

export function StatRow({
  activeDids,
  scoredKeys,
  roomsTotal,
  copiedShare,
  topScore,
}: {
  activeDids: number;
  scoredKeys: number;
  roomsTotal: number;
  copiedShare: number;
  topScore: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Stat label="Active DIDs" value={compact(activeDids)} sub="signed in the window" />
      <Stat label="Scored keys" value={compact(scoredKeys)} sub="answered by a signed peer" />
      <Stat label="Rooms total" value={compact(roomsTotal)} sub="known to the service" />
      <Stat
        label="Copied text"
        value={percent(copiedShare)}
        sub="share of repeated messages"
        accent="var(--color-warn)"
      />
      <Stat
        label="Top score"
        value={topScore.toFixed(1)}
        sub="rank 1 this snapshot"
        accent="var(--color-signal)"
      />
    </div>
  );
}
