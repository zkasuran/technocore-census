"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { scaleLinear, scaleSqrt } from "d3-scale";
import type { Network, NetworkNode } from "@/lib/types";
import { percent } from "@/lib/ui";

// The layout runs once on the client. Nodes carry x/y after ticking, links point
// at node objects once forceLink resolves the string ids it was given.
type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { weight: number };

// Connected clusters cycle through the green and cool family. Isolated nodes are
// forced to the flag color no matter which cluster they sit in, so the eye reads
// "self-talking" before it reads "which cluster".
const CONNECTED_PALETTE = [
  "#35e0a1",
  "#4aa8ff",
  "#2fd4c4",
  "#7ee08a",
  "#5ec8d8",
  "#8ad06a",
];
const ISOLATED_COLOR = "#ff5c6c";

const WIDTH = 960;
const HEIGHT = 600;
const PAD = 28;

function nodeColor(node: NetworkNode): string {
  if (node.isolated) return ISOLATED_COLOR;
  return CONNECTED_PALETTE[node.cluster % CONNECTED_PALETTE.length];
}

interface Hover {
  node: NetworkNode;
  x: number;
  y: number;
}

interface Placed {
  nodes: SimNode[];
  links: SimLink[];
  viewBox: string;
}

export function Graph({ network }: { network: Network }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const maxScore = useMemo(
    () => network.nodes.reduce((m, n) => (n.score > m ? n.score : m), 0) || 1,
    [network.nodes],
  );
  const radius = useMemo(
    () => scaleSqrt().domain([0, maxScore]).range([3, 16]).clamp(true),
    [maxScore],
  );
  const edgeWidth = useMemo(() => {
    const weights = network.edges.map((e) => e.weight);
    const lo = weights.length ? Math.min(...weights) : 1;
    const hi = weights.length ? Math.max(...weights) : 1;
    return scaleLinear().domain([lo, hi]).range([0.4, 2.6]).clamp(true);
  }, [network.edges]);

  // Lay the graph out once: seed sim nodes, run to a settled state synchronously,
  // then freeze positions into state. For ~200 nodes this is well under one frame,
  // so there is no per-tick React churn and hover stays cheap.
  const [placed, setPlaced] = useState<Placed | null>(null);
  useEffect(() => {
    const nodes: SimNode[] = network.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = network.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(60)
          .strength(0.4),
      )
      .force("charge", forceManyBody<SimNode>().strength(-140))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radius(d.score) + 3),
      )
      .stop();

    for (let i = 0; i < 320; i++) sim.tick();

    // Fit the settled cloud into a padded viewBox so nothing clips at the edges.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const r = radius(n.score);
      minX = Math.min(minX, (n.x ?? 0) - r);
      minY = Math.min(minY, (n.y ?? 0) - r);
      maxX = Math.max(maxX, (n.x ?? 0) + r);
      maxY = Math.max(maxY, (n.y ?? 0) + r);
    }
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = WIDTH;
      maxY = HEIGHT;
    }
    const vb = `${minX - PAD} ${minY - PAD} ${maxX - minX + PAD * 2} ${maxY - minY + PAD * 2}`;
    setPlaced({ nodes, links, viewBox: vb });
  }, [network, radius]);

  function onEnter(node: NetworkNode, e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    setHover({
      node,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  }
  function onMove(e: React.MouseEvent) {
    if (!hover) return;
    const rect = containerRef.current?.getBoundingClientRect();
    setHover({ ...hover, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
  }

  const isolatedCount = useMemo(
    () => network.nodes.filter((n) => n.isolated).length,
    [network.nodes],
  );

  return (
    <div>
      <div ref={containerRef} className="card relative overflow-hidden p-2">
        {placed ? (
          <svg
            viewBox={placed.viewBox}
            className="h-[560px] w-full"
            role="img"
            aria-label="Reply network graph. Nodes are did:keys, edges are replies between them."
          >
            <g stroke="var(--color-line)" strokeOpacity={0.5}>
              {placed.links.map((link, i) => {
                const s = link.source as SimNode;
                const t = link.target as SimNode;
                return (
                  <line
                    key={i}
                    x1={s.x ?? 0}
                    y1={s.y ?? 0}
                    x2={t.x ?? 0}
                    y2={t.y ?? 0}
                    strokeWidth={edgeWidth(link.weight)}
                  />
                );
              })}
            </g>
            <g>
              {placed.nodes.map((n) => {
                const color = nodeColor(n);
                const isHot = hover?.node.id === n.id;
                return (
                  <circle
                    key={n.id}
                    cx={n.x ?? 0}
                    cy={n.y ?? 0}
                    r={radius(n.score)}
                    fill={color}
                    fillOpacity={n.signed ? 0.9 : 0.5}
                    stroke={isHot ? "var(--color-ink)" : color}
                    strokeWidth={isHot ? 1.5 : 0.5}
                    className="cursor-pointer transition-[stroke-width]"
                    onMouseEnter={(e) => onEnter(n, e)}
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => router.push(`/key/${encodeURIComponent(n.id)}`)}
                  >
                    <title>{n.short}</title>
                  </circle>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="flex h-[560px] items-center justify-center text-sm text-[color:var(--color-ink-faint)]">
            Laying out {network.nodes.length.toLocaleString("en-US")} keys…
          </div>
        )}

        {hover && (
          <div
            className="pointer-events-none absolute z-30 w-56 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-3 text-xs shadow-lg"
            style={{
              left: Math.min(hover.x + 14, WIDTH - 220),
              top: hover.y + 14,
            }}
          >
            <div className="mono text-[color:var(--color-ink)]">{hover.node.short}</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[color:var(--color-ink-dim)]">
              <dt>Score</dt>
              <dd className="mono text-right text-[color:var(--color-ink)]">
                {hover.node.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </dd>
              <dt>Cluster</dt>
              <dd className="mono text-right text-[color:var(--color-ink)]">{hover.node.cluster}</dd>
              <dt>Signed</dt>
              <dd className="text-right" style={{ color: hover.node.signed ? "var(--color-signal)" : "var(--color-ink-faint)" }}>
                {hover.node.signed ? "yes" : "nickname"}
              </dd>
              <dt>Isolated</dt>
              <dd className="text-right" style={{ color: hover.node.isolated ? ISOLATED_COLOR : "var(--color-signal)" }}>
                {hover.node.isolated ? "yes" : "no"}
              </dd>
            </dl>
            <div className="mt-2 text-[color:var(--color-ink-faint)]">Click to open the profile</div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            Legend
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: CONNECTED_PALETTE[0] }} />
              <span className="text-[color:var(--color-ink-dim)]">
                Connected key, colored by cluster in the green and cool family
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: ISOLATED_COLOR }} />
              <span className="text-[color:var(--color-ink-dim)]">
                Isolated cluster that only answers itself, the shape a filter cuts
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded-full border border-dashed border-[color:var(--color-ink-faint)]" />
              <span className="text-[color:var(--color-ink-dim)]">
                Radius scales with score, edge width with reply weight, dim fill is a nickname
              </span>
            </li>
          </ul>
          <div className="mt-3 text-xs text-[color:var(--color-ink-faint)]">
            {isolatedCount.toLocaleString("en-US")} of{" "}
            {network.nodes.length.toLocaleString("en-US")} keys drawn sit in an isolated cluster (
            {percent(isolatedCount / (network.nodes.length || 1))}).
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            What the export says
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
            {network.note ||
              "Edges are replies between did:keys. A cluster that only exchanges messages with itself looks the same whether it is two people or one operator holding several keys, so the size and the share are the signal, not membership."}
          </p>
          <div className="mt-3 text-xs text-[color:var(--color-ink-faint)]">
            {network.clusters.toLocaleString("en-US")} clusters in this export. Measured from the
            service&apos;s own public data, not an official FLOP number.
          </div>
        </div>
      </div>
    </div>
  );
}
