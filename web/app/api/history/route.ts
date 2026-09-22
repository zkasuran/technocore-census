import { getHistory, getCensus } from "@/lib/data";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";

export function GET() {
  const history = getHistory();
  return Response.json(
    {
      note: NOTE,
      captured_at: getCensus().captured_at,
      history,
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
