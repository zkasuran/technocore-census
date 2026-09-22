import { getKey, getCensus } from "@/lib/data";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";

// The [id] segment is a URL-encoded did:key. Next hands params as a Promise in 15.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = decodeURIComponent(id);
  const key = getKey(identity);
  const captured_at = getCensus().captured_at;

  if (!key) {
    return Response.json(
      {
        note: NOTE,
        captured_at,
        error: "not_found",
        identity,
      },
      { status: 404, headers: { "Cache-Control": CACHE } },
    );
  }

  return Response.json(
    {
      note: NOTE,
      captured_at,
      key,
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
