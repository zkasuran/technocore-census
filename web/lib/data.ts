/*
 * Server-side data access. The sliced files under public/data are the fast path for
 * pages; the full 13MB report under ../data is read only by API routes serving the
 * long tail. All reads are from the filesystem at build or request time, never the
 * network, so the site always matches the committed snapshot.
 */
import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Leaderboard, Census, Radar, Feed, History, KeyRow, Report } from "./types";

const WEB = process.cwd();
const PUB = join(WEB, "public", "data");
const REPO_DATA = join(WEB, "..", "data");

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function getLeaderboard(): Leaderboard {
  return readJson<Leaderboard>(join(PUB, "leaderboard.json"), {
    captured_at: "",
    method: { formula: "", max_answers_per_responder: 0, reply_distance: 0, note: "" },
    totals: {},
    rows: [],
  });
}

export function getCensus(): Census {
  return readJson<Census>(join(PUB, "census.json"), {
    base_url: "",
    captured_at: "",
    derived: {},
    service: {},
    window: {},
  });
}

export function getRadar(): Radar {
  return readJson<Radar>(join(PUB, "radar.json"), {} as Radar);
}

export function getFeed(): Feed {
  return readJson<Feed>(join(PUB, "feed.json"), {
    threads: [],
    method: { note: "", ranked_by: "", thread_gap_seconds: 0 },
    totals: { conversational: 0, threads_found: 0 },
  });
}

export function getHistory(): History {
  return readJson<History>(join(PUB, "history.json"), { points: [] });
}

/** The full report, read only server-side for the long tail of keys. */
export function getFullReport(): Report | null {
  const path = join(REPO_DATA, "report.json");
  if (!existsSync(path)) return null;
  return readJson<Report | null>(path, null);
}

/** Look up one key by full did:key, from the profile slice first then the full report. */
export function getKey(identity: string): KeyRow | null {
  const sliced = join(PUB, "keys", `${encodeURIComponent(identity)}.json`);
  if (existsSync(sliced)) return readJson<KeyRow | null>(sliced, null);
  const report = getFullReport();
  if (!report) return null;
  return report.index.keys.find((k) => k.identity === identity) ?? null;
}

/** The did:keys we pre-render profile pages for (top slice). */
export function profileIdentities(): string[] {
  const index = readJson<Record<string, string>>(join(PUB, "keys-index.json"), {});
  return Object.values(index);
}

export function shortDid(did: string): string {
  const tail = did.replace(/^did:key:z/, "");
  return tail.length > 12 ? `${tail.slice(0, 4)}…${tail.slice(-6)}` : tail;
}
