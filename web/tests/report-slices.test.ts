/*
 * The next-level data reached the sliced files the frontend ships against.
 *
 * data-slices.test.ts already checks the envelopes parse and rows look like KeyRow. This
 * file narrows onto the two features this wave added on the backend: the per-key risk band
 * and the radar's risk aggregate. It reads the committed slices under web/public/data, the
 * same files the site loads, and checks the new shapes match lib/types.ts. If a report was
 * sliced with a network block anywhere, its node and edge shapes are checked too; if it was
 * not (prepare-data does not currently emit a network slice) that check skips with a note
 * rather than inventing a pass.
 *
 * A missing slice is a regression, not a skip: readSlice throws with the command to run.
 * "skip" here means only the optional-by-design network slice, never the core files.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { KeyRow, RiskScore, Network } from "@/lib/types";

const DATA = join(process.cwd(), "public", "data");
const BANDS = new Set(["clear", "watch", "flag"]);

function slicePath(name: string): string {
  return join(DATA, name);
}

function readSlice<T>(name: string): T {
  const path = slicePath(name);
  if (!existsSync(path)) {
    throw new Error(
      `slice ${name} is missing at ${path}. Run \`npm run prepare-data\` before the tests.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isRiskScore(value: unknown): value is RiskScore {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.score === "number" &&
    r.score >= 0 &&
    r.score <= 1 &&
    typeof r.band === "string" &&
    BANDS.has(r.band) &&
    Array.isArray(r.reasons) &&
    (r.reasons as unknown[]).every((x) => typeof x === "string")
  );
}

describe("leaderboard.json risk", () => {
  it("carries a well-formed risk block on rows that have one", () => {
    const lb = readSlice<{ rows: KeyRow[] }>("leaderboard.json");
    expect(lb.rows.length).toBeGreaterThan(0);

    const withRisk = lb.rows.filter((row) => row.risk !== undefined);
    // The committed slice is produced from a report the risk pipeline ran over, so at least
    // one row should carry a risk block. If none do, the feature did not reach the slice.
    expect(withRisk.length).toBeGreaterThan(0);

    for (const row of withRisk) {
      expect(isRiskScore(row.risk)).toBe(true);
    }
  });

  it("keeps every risk band inside the published set and score in range", () => {
    const lb = readSlice<{ rows: KeyRow[] }>("leaderboard.json");
    for (const row of lb.rows) {
      if (!row.risk) continue;
      expect(BANDS.has(row.risk.band)).toBe(true);
      expect(row.risk.score).toBeGreaterThanOrEqual(0);
      expect(row.risk.score).toBeLessThanOrEqual(1);
      // The module's contract: no reason means the clear band at score zero.
      if (row.risk.reasons.length === 0) {
        expect(row.risk.band).toBe("clear");
        expect(row.risk.score).toBe(0);
      }
    }
  });
});

describe("radar.json risk aggregate", () => {
  it("has a risk object with the three bands and a scored total that adds up", () => {
    const radar = readSlice<Record<string, unknown>>("radar.json");
    expect(radar).toHaveProperty("risk");

    const risk = radar.risk as {
      scored: number;
      bands: Record<string, number>;
      flagged_share: number | null;
      method: string;
    };
    expect(typeof risk.scored).toBe("number");
    expect(typeof risk.method).toBe("string");

    // Exactly the three published bands, no more.
    expect(new Set(Object.keys(risk.bands))).toEqual(BANDS);

    // The band counts partition the scored keys.
    const summed = Object.values(risk.bands).reduce((a, b) => a + b, 0);
    expect(summed).toBe(risk.scored);

    // flagged_share is the flag count over the scored total, rounded to 4 dp, or null when
    // nothing was scored.
    if (risk.scored === 0) {
      expect(risk.flagged_share).toBeNull();
    } else {
      const expected = Math.round((risk.bands.flag / risk.scored) * 1e4) / 1e4;
      expect(risk.flagged_share).toBeCloseTo(expected, 4);
    }
  });

  it("agrees with the leaderboard: no row's band falls outside the aggregate's set", () => {
    const radar = readSlice<{ risk: { bands: Record<string, number> } }>("radar.json");
    const lb = readSlice<{ rows: KeyRow[] }>("leaderboard.json");
    const bands = new Set(Object.keys(radar.risk.bands));
    for (const row of lb.rows) {
      if (row.risk) expect(bands.has(row.risk.band)).toBe(true);
    }
  });
});

describe("network slice (optional)", () => {
  const NAMES = ["network.json", "graph.json"];
  const present = NAMES.find((name) => existsSync(slicePath(name)));

  it.skipIf(!present)("matches the Network shape in lib/types.ts", () => {
    const net = readSlice<Network>(present as string);
    expect(Array.isArray(net.nodes)).toBe(true);
    expect(Array.isArray(net.edges)).toBe(true);
    expect(typeof net.clusters).toBe("number");

    const ids = new Set(net.nodes.map((n) => n.id));
    for (const node of net.nodes) {
      expect(node.id.startsWith("did:key:")).toBe(true);
      expect(node.signed).toBe(true);
      expect(typeof node.short).toBe("string");
      expect(typeof node.score).toBe("number");
      expect(typeof node.cluster).toBe("number");
      expect(typeof node.isolated).toBe("boolean");
    }
    // No dangling edge endpoint, so a force layout has every node it references.
    for (const edge of net.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
      expect(edge.weight).toBeGreaterThanOrEqual(1);
    }
  });

  it("notes when no network slice is emitted", () => {
    if (!present) {
      // prepare-data does not currently write a network slice; report.network lives only in
      // the full report.json. This is a documented gap, asserted so it reads as intentional.
      expect(present).toBeUndefined();
    } else {
      expect(NAMES).toContain(present);
    }
  });
});
