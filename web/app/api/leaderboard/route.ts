import { getLeaderboard, getFullReport } from "@/lib/data";
import type { KeyRow } from "@/lib/types";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";

// The sliced leaderboard.json carries the top 500. A larger limit reads the full
// report index, which holds every scored key. We cap the served list at 2000 so a
// single request never has to serialize the whole 25k-row tail.
const SLICE_MAX = 500;
const HARD_MAX = 2000;

function clampLimit(raw: string | null): number {
  const n = raw === null ? 100 : Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(n, HARD_MAX);
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const signedOnly = searchParams.get("signed") === "true";

  const board = getLeaderboard();

  let source: KeyRow[] = board.rows;
  let fromFullReport = false;
  if (limit > SLICE_MAX) {
    const report = getFullReport();
    if (report) {
      source = report.index.keys;
      fromFullReport = true;
    }
  }

  const filtered = signedOnly ? source.filter((r) => r.signed) : source;
  const rows = filtered.slice(0, limit);

  return Response.json(
    {
      note: NOTE,
      captured_at: board.captured_at,
      method: board.method,
      totals: board.totals,
      count: rows.length,
      limit,
      signed_only: signedOnly,
      source: fromFullReport ? "full-report" : "top-slice",
      rows,
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
