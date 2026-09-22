import { Shell } from "@/components/Shell";
import { Card } from "@/components/primitives";
import { getCensus, getLeaderboard, getRadar, getHistory } from "@/lib/data";
import { Reveal } from "@/components/ui/motion";
import { Hero } from "@/components/overview/Hero";
import { StatRow } from "@/components/overview/StatRow";
import { Sparkline } from "@/components/overview/Sparkline";
import { TopKeys } from "@/components/overview/TopKeys";
import { ScoreExplainer } from "@/components/overview/ScoreExplainer";
import { HonestyNote } from "@/components/overview/HonestyNote";

/** Read one numeric field off a loose record, defaulting to 0. */
function num(record: Record<string, unknown>, key: string): number {
  const v = record[key];
  return typeof v === "number" ? v : 0;
}

export default function OverviewPage() {
  const census = getCensus();
  const leaderboard = getLeaderboard();
  const radar = getRadar();
  const history = getHistory();

  const activeDids = num(census.derived, "dids_active");
  const scoredKeys = leaderboard.totals.keys_scored ?? radar.keys?.scored ?? 0;
  const roomsTotal = num(census.service, "rooms_total");
  const copiedShare = radar.boilerplate?.copied_share ?? 0;
  const topScore = leaderboard.rows[0]?.score ?? 0;
  const signedShare = num(census.derived, "signed_share");

  return (
    <Shell active="/">
      <div className="flex flex-col gap-8">
        <Reveal>
          <Hero capturedAt={census.captured_at} signedShare={signedShare} />
        </Reveal>

        <Reveal delay={60}>
          <StatRow
            activeDids={activeDids}
            scoredKeys={scoredKeys}
            roomsTotal={roomsTotal}
            copiedShare={copiedShare}
            topScore={topScore}
            signedShare={signedShare}
          />
        </Reveal>

        <Reveal delay={120}>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="card-hover lg:col-span-1">
              <Sparkline points={history.points} field="scored" label="Scored keys over time" />
            </Card>
            <div className="lg:col-span-2">
              <TopKeys rows={leaderboard.rows} />
            </div>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <ScoreExplainer method={leaderboard.method} />
        </Reveal>

        <Reveal delay={60}>
          <HonestyNote />
        </Reveal>
      </div>
    </Shell>
  );
}
