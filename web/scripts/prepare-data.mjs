/*
 * Slice the 13MB report.json into the small files the frontend actually ships.
 * The full report has ~25k keys; the browser never loads that. This writes:
 *   public/data/leaderboard.json  top signed keys + method + totals
 *   public/data/census.json       network aggregates
 *   public/data/radar.json        sybil signals
 *   public/data/feed.json         conversational threads
 *   public/data/history.json      the longitudinal series (from data/history/*.json)
 *   public/data/keys/<short>.json per-key detail for the top slice (SSG profiles)
 *   public/data/keys-index.json   {short: identity} for the top slice
 * The long tail stays server-side in data/report.json, read by /api routes.
 *
 * Deterministic and idempotent: same report in, same slices out. Safe to run in
 * predev/prebuild. Never fetches the network.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const REPO = join(WEB, "..");
const DATA = join(REPO, "data");
const OUT = join(WEB, "public", "data");
const KEYS_OUT = join(OUT, "keys");

const TOP_KEYS = 500; // leaderboard rows shipped to the browser
const TOP_PROFILES = 250; // per-key SSG profile pages

function short(did) {
  const tail = did.replace(/^did:key:z/, "");
  return tail.slice(0, 4) + "…" + tail.slice(-6);
}

function load(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(KEYS_OUT, { recursive: true });

  const report = load(join(DATA, "report.json"));
  if (!report) {
    console.error("prepare-data: data/report.json missing, writing empty slices");
    writeFileSync(join(OUT, "leaderboard.json"), JSON.stringify({ rows: [], totals: {}, method: {}, captured_at: null }));
    return;
  }

  const keys = report.index?.keys ?? [];
  const captured_at = report.census?.captured_at ?? null;

  writeFileSync(
    join(OUT, "leaderboard.json"),
    JSON.stringify({
      captured_at,
      method: report.index?.method ?? {},
      totals: report.index?.totals ?? {},
      rows: keys.slice(0, TOP_KEYS),
    }),
  );

  writeFileSync(join(OUT, "census.json"), JSON.stringify(report.census ?? {}));
  writeFileSync(join(OUT, "radar.json"), JSON.stringify(report.radar ?? {}));
  writeFileSync(join(OUT, "feed.json"), JSON.stringify(report.feed ?? {}));

  // Per-key profiles for the top slice. Long tail is served by /api/key/[id].
  const index = {};
  for (const row of keys.slice(0, TOP_PROFILES)) {
    const s = short(row.identity);
    index[s] = row.identity;
    writeFileSync(join(KEYS_OUT, `${encodeURIComponent(row.identity)}.json`), JSON.stringify(row));
  }
  writeFileSync(join(OUT, "keys-index.json"), JSON.stringify(index));

  // History: fold every data/history/*.json daily report into one series. The daily
  // refresh commits a dated report; until then this is a single point from the current one.
  const points = [];
  const histDir = join(DATA, "history");
  if (existsSync(histDir)) {
    for (const f of readdirSync(histDir).filter((n) => n.endsWith(".json")).sort()) {
      const h = load(join(histDir, f));
      if (h) points.push(pointOf(h, f.replace(/\.json$/, "")));
    }
  }
  if (points.length === 0) points.push(pointOf(report, (captured_at ?? "").slice(0, 10)));
  writeFileSync(join(OUT, "history.json"), JSON.stringify({ points }));

  console.log(
    `prepare-data: ${keys.length} keys -> ${TOP_KEYS} leaderboard, ${Math.min(TOP_PROFILES, keys.length)} profiles, ${points.length} history points`,
  );
}

function pointOf(report, date) {
  const d = report.census?.derived ?? {};
  const r = report.radar ?? {};
  const keys = report.index?.keys ?? [];
  return {
    date,
    dids_active: d.dids_active ?? 0,
    scored: r.keys?.scored ?? 0,
    rooms_total: report.census?.service?.rooms_total ?? 0,
    copied_share: r.boilerplate?.copied_share ?? 0,
    never_answered_share: r.keys?.never_answered_share ?? 0,
    top_score: keys[0]?.score ?? 0,
  };
}

main();
