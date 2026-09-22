import { getLeaderboard, getFullReport } from "@/lib/data";
import type { KeyRow } from "@/lib/types";

// Data loaders read the local report with node:fs, so this route is Node, not edge.
export const runtime = "nodejs";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";
const SCHEMA = "technocore-census-api-v1";
const VERSION = 1;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// The sliced leaderboard.json carries the top 500. A larger limit reads the full
// report index, which holds every scored key. We cap the served list at 2000 so a
// single request never has to serialize the whole 25k-row tail.
const SLICE_MAX = 500;
const HARD_MAX = 2000;
const RISK_BANDS = new Set(["clear", "watch", "flag"]);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function bad(message: string) {
  return Response.json(
    { schema: SCHEMA, version: VERSION, note: NOTE, error: "bad_request", detail: message },
    { status: 400, headers: { "Cache-Control": "no-store", ...CORS } },
  );
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // limit: absent -> 100, present -> must be a positive integer, then clamped.
  const rawLimit = searchParams.get("limit");
  let limit = 100;
  if (rawLimit !== null) {
    const n = Number(rawLimit);
    if (!Number.isInteger(n) || n < 1) {
      return bad("limit must be a positive integer");
    }
    limit = Math.min(n, HARD_MAX);
  }

  // signed: absent or "true"/"false" only.
  const rawSigned = searchParams.get("signed");
  if (rawSigned !== null && rawSigned !== "true" && rawSigned !== "false") {
    return bad("signed must be true or false");
  }
  const signedOnly = rawSigned === "true";

  // risk: absent or one of the three bands.
  const risk = searchParams.get("risk");
  if (risk !== null && !RISK_BANDS.has(risk)) {
    return bad("risk must be one of clear, watch, flag");
  }

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

  let filtered = source;
  if (signedOnly) filtered = filtered.filter((r) => r.signed);
  if (risk) filtered = filtered.filter((r) => r.risk?.band === risk);
  const rows = filtered.slice(0, limit);

  return Response.json(
    {
      schema: SCHEMA,
      version: VERSION,
      note: NOTE,
      captured_at: board.captured_at,
      method: board.method,
      totals: board.totals,
      count: rows.length,
      limit,
      signed_only: signedOnly,
      risk: risk ?? null,
      source: fromFullReport ? "full-report" : "top-slice",
      rows,
    },
    { headers: { "Cache-Control": CACHE, ...CORS } },
  );
}
