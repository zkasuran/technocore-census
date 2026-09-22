/*
 * Render smoke tests for web/components/primitives.tsx.
 * These primitives (Card, Stat, Badge, PageHead) import only cn() from lib/ui,
 * which is client-safe, so they render in jsdom with no server-only module in
 * the graph. We assert the text they show and a class or two that other lanes
 * key off (the .card shell, the tone class on a Badge, the accent style on a Stat).
 *
 * Deferred to the build: anything under components/ or app/ that pulls in
 * lib/data.ts (server-only, reads the filesystem). Those are not importable in
 * jsdom and are covered by `next build` + typecheck instead.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, Stat, Badge, PageHead } from "@/components/primitives";

describe("Card", () => {
  it("renders its children inside the .card shell", () => {
    render(<Card>hello card</Card>);
    const el = screen.getByText("hello card");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("card");
    expect(el).toHaveClass("p-5");
  });

  it("adds the glow-signal class when glow is set", () => {
    render(<Card glow>glowing</Card>);
    expect(screen.getByText("glowing")).toHaveClass("glow-signal");
  });

  it("merges an extra className", () => {
    render(<Card className="extra-x">merged</Card>);
    expect(screen.getByText("merged")).toHaveClass("extra-x");
  });
});

describe("Stat", () => {
  it("renders the label, value and sub text", () => {
    render(<Stat label="Signed keys" value="1.2k" sub="of all keys" />);
    expect(screen.getByText("Signed keys")).toBeInTheDocument();
    expect(screen.getByText("1.2k")).toBeInTheDocument();
    expect(screen.getByText("of all keys")).toBeInTheDocument();
  });

  it("applies the accent color to the value when given", () => {
    render(<Stat label="Risk" value="42" accent="var(--color-flag)" />);
    const value = screen.getByText("42");
    expect(value).toHaveStyle({ color: "var(--color-flag)" });
  });

  it("omits the sub line when not provided", () => {
    render(<Stat label="Rooms" value="7" />);
    expect(screen.queryByText("of all keys")).not.toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>signed</Badge>);
    expect(screen.getByText("signed")).toBeInTheDocument();
  });

  it("uses the signal tone by default", () => {
    render(<Badge>default tone</Badge>);
    expect(screen.getByText("default tone").className).toContain("var(--color-signal)");
  });

  it("switches to the flag tone class when asked", () => {
    render(<Badge tone="flag">flagged</Badge>);
    expect(screen.getByText("flagged").className).toContain("var(--color-flag)");
  });
});

describe("PageHead", () => {
  it("renders the title as a heading", () => {
    render(<PageHead title="Census" />);
    expect(screen.getByRole("heading", { name: "Census" })).toBeInTheDocument();
  });

  it("renders the lede when provided and omits it otherwise", () => {
    const { rerender } = render(<PageHead title="A" lede="the lede text" />);
    expect(screen.getByText("the lede text")).toBeInTheDocument();
    rerender(<PageHead title="B" />);
    expect(screen.queryByText("the lede text")).not.toBeInTheDocument();
  });
});
