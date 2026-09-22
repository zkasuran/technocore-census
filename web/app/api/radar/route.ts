import { getRadar, getCensus } from "@/lib/data";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";

export function GET() {
  const radar = getRadar();
  return Response.json(
    {
      note: NOTE,
      captured_at: getCensus().captured_at,
      radar,
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
