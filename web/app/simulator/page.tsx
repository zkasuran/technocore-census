import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/primitives";
import { getLeaderboard } from "@/lib/data";
import { Simulator } from "@/components/simulator/Simulator";

export const metadata: Metadata = {
  title: "Eligibility simulator",
  description:
    "Move the weights and watch the technocore.chat contribution index reshuffle. A what-if tool over public data, not an official FLOP metric and it decides no allocation.",
};

export default function SimulatorPage() {
  const board = getLeaderboard();
  const { rows, method, captured_at } = board;
  const signedRows = rows.filter((r) => r.signed);

  return (
    <Shell active="/simulator">
      <PageHead
        title="Eligibility simulator"
        lede="Useful work is a judgement made from outside. The published score is one transparent way to make it. Move the weights below and watch the ranking reshuffle, so the ordering is legible rather than magic."
      />
      <Simulator rows={signedRows} publishedFormula={method.formula} capturedAt={capturedAt(captured_at)} />
    </Shell>
  );
}

function capturedAt(iso: string): string {
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
