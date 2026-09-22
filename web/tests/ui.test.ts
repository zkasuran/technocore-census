/*
 * Unit tests for web/lib/ui.ts, the client-safe formatting helpers.
 * These are pure functions with no I/O, so every case here is deterministic
 * and must pass. Covered: shortDid, compact (including its M/k boundaries),
 * percent, riskColor bands, and cn class merging.
 */
import { describe, it, expect } from "vitest";
import { cn, shortDid, compact, percent, riskColor } from "@/lib/ui";

describe("shortDid", () => {
  it("truncates a real did:key to head…tail after stripping the did:key:z prefix", () => {
    const did = "did:key:z6Mkpwrt9ycyoxcmVsp5vRQ4JeS55QmBXEv6kFiJqPFYVrn5";
    // tail after stripping "did:key:z" is "6Mkpwrt...Vrn5", length > 12 so it folds.
    expect(shortDid(did)).toBe("6Mkp…FYVrn5");
  });

  it("leaves a short string untouched when the remainder is 12 chars or fewer", () => {
    // No did:key:z prefix, 8 chars, under the 12 threshold.
    expect(shortDid("abcdefgh")).toBe("abcdefgh");
  });

  it("returns exactly the boundary string unchanged at length 12", () => {
    expect(shortDid("abcdefghijkl")).toBe("abcdefghijkl");
  });

  it("folds a string one char over the boundary", () => {
    // 13 chars, > 12, folds to first 4 + … + last 6.
    expect(shortDid("abcdefghijklm")).toBe("abcd…hijklm");
  });
});

describe("compact", () => {
  it("formats sub-thousand numbers verbatim", () => {
    expect(compact(0)).toBe("0");
    expect(compact(42)).toBe("42");
  });

  it("keeps 999 verbatim just below the k boundary", () => {
    expect(compact(999)).toBe("999"); // 999 < 1000, printed as-is
  });

  it("switches to k at exactly 1000 with one decimal", () => {
    expect(compact(1_000)).toBe("1.0k");
  });

  it("drops the decimal at and above 10k", () => {
    expect(compact(9_999)).toBe("10.0k"); // 9.999 -> 10.0 (still under 10000)
    expect(compact(10_000)).toBe("10k");
    expect(compact(15_500)).toBe("16k"); // 15.5 -> toFixed(0) rounds to 16
  });

  it("switches to M at exactly 1,000,000 with one decimal", () => {
    expect(compact(1_000_000)).toBe("1.0M");
    expect(compact(2_500_000)).toBe("2.5M");
  });

  it("drops the decimal at and above 10M", () => {
    expect(compact(10_000_000)).toBe("10M");
    expect(compact(12_400_000)).toBe("12M");
  });
});

describe("percent", () => {
  it("multiplies by 100 and appends a percent sign with one decimal by default", () => {
    expect(percent(0.5)).toBe("50.0%");
    expect(percent(0)).toBe("0.0%");
    expect(percent(1)).toBe("100.0%");
  });

  it("honours a custom digit count", () => {
    expect(percent(0.12345, 2)).toBe("12.35%");
    expect(percent(0.5, 0)).toBe("50%");
  });
});

describe("riskColor", () => {
  it("maps flag to the flag token", () => {
    expect(riskColor("flag")).toBe("var(--color-flag)");
  });

  it("maps watch to the warn token", () => {
    expect(riskColor("watch")).toBe("var(--color-warn)");
  });

  it("maps clear to the signal token", () => {
    expect(riskColor("clear")).toBe("var(--color-signal)");
  });

  it("falls back to the signal token for undefined or unknown bands", () => {
    expect(riskColor(undefined)).toBe("var(--color-signal)");
    expect(riskColor("whatever")).toBe("var(--color-signal)");
  });
});

describe("cn", () => {
  it("joins simple class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("resolves conditional object syntax from clsx", () => {
    expect(cn("base", { on: true, off: false })).toBe("base on");
  });

  it("lets a later tailwind utility win a conflict via tailwind-merge", () => {
    // twMerge keeps the last of two conflicting padding utilities.
    expect(cn("p-2", "p-5")).toBe("p-5");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});
