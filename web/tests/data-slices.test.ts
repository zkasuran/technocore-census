/*
 * Indirect test of scripts/prepare-data.mjs by asserting its committed output.
 * We do not import the slicer or a 13MB report here. Instead we read the sliced
 * files it already wrote into web/public/data and check they are well-formed and
 * match the types in lib/types.ts. This is the contract the frontend actually
 * ships against.
 *
 * Deferred to the build (not covered here): the slicing logic itself against a
 * fresh report (prepare-data runs in prebuild), and every server component that
 * reads these files (typecheck + next build cover those).
 *
 * If a slice is absent (data never prepared in this checkout) we fail with a
 * clear message rather than passing silently, since a missing slice is a real
 * regression, not a skip condition.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { KeyRow } from "@/lib/types";

// Vitest runs with cwd at the web root (npm run test from web/), so the sliced
// data lives at ./public/data. Resolved from cwd rather than import.meta.url,
// which is not a file:// URL under the vitest transform.
const DATA = join(process.cwd(), "public", "data");

function readSlice<T>(name: string): T {
  const path = join(DATA, name);
  if (!existsSync(path)) {
    throw new Error(
      `slice ${name} is missing at ${path}. Run \`npm run prepare-data\` before the tests.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isKeyRow(row: unknown): row is KeyRow {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.identity === "string" &&
    typeof r.signed === "boolean" &&
    typeof r.rank === "number" &&
    typeof r.score === "number" &&
    typeof r.messages === "number" &&
    typeof r.rooms === "number" &&
    typeof r.first_seen === "string" &&
    typeof r.last_seen === "string"
  );
}

describe("leaderboard.json", () => {
  it("parses and carries the top-slice envelope", () => {
    const lb = readSlice<Record<string, unknown>>("leaderboard.json");
    expect(lb).toHaveProperty("rows");
    expect(lb).toHaveProperty("method");
    expect(lb).toHaveProperty("totals");
    expect(lb).toHaveProperty("captured_at");
    expect(Array.isArray(lb.rows)).toBe(true);
  });

  it("has rows shaped like KeyRow", () => {
    const lb = readSlice<{ rows: unknown[] }>("leaderboard.json");
    expect(lb.rows.length).toBeGreaterThan(0);
    // The slicer caps at 500 rows.
    expect(lb.rows.length).toBeLessThanOrEqual(500);
    for (const row of lb.rows) {
      expect(isKeyRow(row)).toBe(true);
    }
  });

  it("keeps ranks in ascending order across the slice", () => {
    const lb = readSlice<{ rows: KeyRow[] }>("leaderboard.json");
    for (let i = 1; i < lb.rows.length; i++) {
      expect(lb.rows[i].rank).toBeGreaterThanOrEqual(lb.rows[i - 1].rank);
    }
  });
});

describe("census.json", () => {
  it("parses with the Census envelope fields", () => {
    const c = readSlice<Record<string, unknown>>("census.json");
    expect(c).toHaveProperty("base_url");
    expect(c).toHaveProperty("captured_at");
    expect(c).toHaveProperty("derived");
    expect(c).toHaveProperty("service");
    expect(c).toHaveProperty("window");
  });
});

describe("radar.json", () => {
  it("parses with the sybil-signal sections", () => {
    const r = readSlice<Record<string, unknown>>("radar.json");
    expect(r).toHaveProperty("boilerplate");
    expect(r).toHaveProperty("clusters");
    expect(r).toHaveProperty("keys");
  });
});

describe("feed.json", () => {
  it("parses with threads and totals", () => {
    const f = readSlice<{ threads: unknown[]; totals: unknown }>("feed.json");
    expect(Array.isArray(f.threads)).toBe(true);
    expect(f).toHaveProperty("totals");
  });
});

describe("history.json", () => {
  it("parses with at least one point carrying the HistoryPoint fields", () => {
    const h = readSlice<{ points: Array<Record<string, unknown>> }>("history.json");
    expect(Array.isArray(h.points)).toBe(true);
    expect(h.points.length).toBeGreaterThan(0);
    const p = h.points[0];
    expect(typeof p.date).toBe("string");
    expect(typeof p.dids_active).toBe("number");
    expect(typeof p.scored).toBe("number");
    expect(typeof p.top_score).toBe("number");
  });
});

describe("keys-index.json", () => {
  it("maps short ids to full did:keys and is consistent with the leaderboard", () => {
    const index = readSlice<Record<string, string>>("keys-index.json");
    const shorts = Object.keys(index);
    expect(shorts.length).toBeGreaterThan(0);
    // The slicer caps profiles (and thus the index) at 250.
    expect(shorts.length).toBeLessThanOrEqual(250);
    for (const [short, did] of Object.entries(index)) {
      expect(short).toContain("…");
      expect(did.startsWith("did:key:z")).toBe(true);
      // The short is head4 + … + tail6 of the did with its did:key:z stripped.
      const tail = did.replace(/^did:key:z/, "");
      expect(short).toBe(`${tail.slice(0, 4)}…${tail.slice(-6)}`);
    }
  });

  it("points every index entry at a did present in the leaderboard rows", () => {
    const index = readSlice<Record<string, string>>("keys-index.json");
    const lb = readSlice<{ rows: KeyRow[] }>("leaderboard.json");
    const known = new Set(lb.rows.map((r) => r.identity));
    for (const did of Object.values(index)) {
      expect(known.has(did)).toBe(true);
    }
  });
});
