import { getKey, getCensus } from "@/lib/data";

// getKey / getCensus read the local report with node:fs, so this route is Node.
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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// The [id] segment is a URL-encoded did:key. Next hands params as a Promise in 15.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = decodeURIComponent(id);
  const captured_at = getCensus().captured_at;

  if (!identity.startsWith("did:key:")) {
    return Response.json(
      {
        schema: SCHEMA,
        version: VERSION,
        note: NOTE,
        error: "bad_request",
        detail: "id must be a URL-encoded did:key",
        identity,
      },
      { status: 400, headers: { "Cache-Control": "no-store", ...CORS } },
    );
  }

  const key = getKey(identity);
  if (!key) {
    return Response.json(
      {
        schema: SCHEMA,
        version: VERSION,
        note: NOTE,
        captured_at,
        error: "not_found",
        detail: "this did:key was not scored in the current snapshot",
        identity,
      },
      { status: 404, headers: { "Cache-Control": CACHE, ...CORS } },
    );
  }

  // The row carries the full contribution record including risk and movement.
  return Response.json(
    {
      schema: SCHEMA,
      version: VERSION,
      note: NOTE,
      captured_at,
      key,
    },
    { headers: { "Cache-Control": CACHE, ...CORS } },
  );
}
