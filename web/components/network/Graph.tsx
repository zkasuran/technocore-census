"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { scaleLinear, scaleSqrt } from "d3-scale";
import type { Network, NetworkNode } from "@/lib/types";
import { percent } from "@/lib/ui";

// The simulation carries x/y once it ticks. Links point at node objects after
// forceLink resolves the string ids it was seeded with.
type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { weight: number };

// Connected clusters cycle through the signal-green and cool family. Isolated keys
// are forced to the flag color whatever cluster they sit in, so the eye reads
// "self-talking" before it reads "which cluster". Hex mirrors the tokens in
// globals.css because a canvas fillStyle cannot read a CSS variable.
const CONNECTED_PALETTE = ["#35e0a1", "#4aa8ff", "#2fd4c4", "#7ee08a", "#5ec8d8", "#8ad06a"];
const FLAG = "#ff5c6c";
const INK = "#e7eef5";
const LINE = "#1e2833";

const HEIGHT = 560;
const PAD = 30;
// World-space node radius. The fit transform scales positions and radii together, so
// collision (world) maps cleanly onto the drawn (screen) circles.
const R_MIN = 4;
const R_MAX = 22;

function nodeColor(node: NetworkNode): string {
  if (node.isolated) return FLAG;
  return CONNECTED_PALETTE[node.cluster % CONNECTED_PALETTE.length];
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

interface Hover {
  node: NetworkNode;
  sx: number;
  sy: number;
}

export function Graph({ network }: { network: Network }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isolatedOnly, setIsolatedOnly] = useState(false);
  const [width, setWidth] = useState(960);
  const [settling, setSettling] = useState(true);
  const [hover, setHover] = useState<Hover | null>(null);
  // The active key drives the highlight. Hover wins, else the keyboard focus in the list.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const isolatedTotal = useMemo(
    () => network.nodes.filter((n) => n.isolated).length,
    [network.nodes],
  );

  // The subgraph actually drawn. Filtering to isolated keys keeps only those nodes and
  // the edges among them, so the self-talking rings stand alone.
  const view = useMemo(() => {
    if (!isolatedOnly) return network;
    const keep = new Set(network.nodes.filter((n) => n.isolated).map((n) => n.id));
    return {
      ...network,
      nodes: network.nodes.filter((n) => keep.has(n.id)),
      edges: network.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    };
  }, [network, isolatedOnly]);

  const maxScore = useMemo(
    () => view.nodes.reduce((m, n) => (n.score > m ? n.score : m), 0) || 1,
    [view.nodes],
  );
  const radius = useMemo(
    () => scaleSqrt().domain([0, maxScore]).range([R_MIN, R_MAX]).clamp(true),
    [maxScore],
  );
  const edgeWidth = useMemo(() => {
    const weights = view.edges.map((e) => e.weight);
    const lo = weights.length ? Math.min(...weights) : 1;
    const hi = weights.length ? Math.max(...weights) : 1;
    return scaleLinear().domain([lo, hi]).range([0.5, 3]).clamp(true);
  }, [view.edges]);

  // Neighbor lookup for the highlight. A key's own id is in its set so it survives the
  // "dim everything else" pass.
  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of view.nodes) map.set(n.id, new Set([n.id]));
    for (const e of view.edges) {
      map.get(e.source)?.add(e.target);
      map.get(e.target)?.add(e.source);
    }
    return map;
  }, [view.nodes, view.edges]);

  const nodesByScore = useMemo(
    () => [...view.nodes].sort((a, b) => b.score - a.score),
    [view.nodes],
  );

  // Live refs the animation loop, the hit test and the highlight redraw all read, so
  // none of them closes over stale state.
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const transformRef = useRef<Transform>({ scale: 1, tx: 0, ty: 0 });
  const activeRef = useRef<string | null>(null);
  const drawRef = useRef<() => void>(() => {});

  activeRef.current = hoveredId ?? focusedId;

  // Track the container width so the canvas fills it and stays crisp on any viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build and run the simulation. It animates from a cold start and cools to a stop on
  // its own (d3's alphaMin), so it settles instead of jittering forever. Under
  // prefers-reduced-motion it ticks to rest synchronously and paints one frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(HEIGHT * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;

    const nodes: SimNode[] = view.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = view.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    simNodesRef.current = nodes;
    simLinksRef.current = links;

    function paint() {
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);

      // Fit the current cloud into the canvas with padding, scaling positions and radii
      // by one factor so nothing clips while the layout is still moving.
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
        maxX = width;
        maxY = HEIGHT;
      }
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const scale = Math.min((width - PAD * 2) / bw, (HEIGHT - PAD * 2) / bh, 2.5);
      const tx = (width - bw * scale) / 2 - minX * scale;
      const ty = (HEIGHT - bh * scale) / 2 - minY * scale;
      transformRef.current = { scale, tx, ty };

      const active = activeRef.current;
      const near = active ? neighbors.get(active) : undefined;

      // Edges first, faint. When a key is active, edges touching its neighborhood read
      // brighter and the rest fall away.
      for (const link of links) {
        const s = link.source as SimNode;
        const t = link.target as SimNode;
        const lit = active ? (near?.has(s.id) && near?.has(t.id)) : true;
        ctx.beginPath();
        ctx.moveTo((s.x ?? 0) * scale + tx, (s.y ?? 0) * scale + ty);
        ctx.lineTo((t.x ?? 0) * scale + tx, (t.y ?? 0) * scale + ty);
        ctx.strokeStyle = lit ? "rgba(159,176,192,0.55)" : LINE;
        ctx.globalAlpha = active ? (lit ? 0.9 : 0.12) : 0.5;
        ctx.lineWidth = edgeWidth(link.weight);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes on top. Non-neighbors dim to a whisper when something is active.
      for (const n of nodes) {
        const cx = (n.x ?? 0) * scale + tx;
        const cy = (n.y ?? 0) * scale + ty;
        const r = Math.max(radius(n.score) * scale, 2.2);
        const inFocus = !active || near?.has(n.id);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(n);
        ctx.globalAlpha = inFocus ? (n.signed ? 0.92 : 0.5) : 0.12;
        ctx.fill();
        if (active === n.id) {
          ctx.globalAlpha = 1;
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
        } else if (inFocus) {
          ctx.globalAlpha = n.signed ? 0.9 : 0.5;
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = nodeColor(n);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    drawRef.current = paint;

    const sim: Simulation<SimNode, SimLink> = forceSimulation<SimNode>(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(58)
          .strength(0.35),
      )
      .force("charge", forceManyBody<SimNode>().strength(-150))
      .force("center", forceCenter(width / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radius(d.score) + 3),
      )
      .stop();

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    setSettling(true);
    if (reduce) {
      for (let i = 0; i < 300; i++) sim.tick();
      paint();
      setSettling(false);
    } else {
      const step = () => {
        sim.tick();
        paint();
        if (sim.alpha() > sim.alphaMin()) {
          raf = requestAnimationFrame(step);
        } else {
          setSettling(false);
        }
      };
      raf = requestAnimationFrame(step);
    }

    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
    };
  }, [view, width, radius, edgeWidth, neighbors]);

  // Repaint on highlight change without rebuilding the layout.
  useEffect(() => {
    drawRef.current();
  }, [hoveredId, focusedId]);

  const hitTest = useCallback((clientX: number, clientY: number): Hover | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { scale, tx, ty } = transformRef.current;
    let best: Hover | null = null;
    let bestDist = Infinity;
    for (const n of simNodesRef.current) {
      const cx = (n.x ?? 0) * scale + tx;
      const cy = (n.y ?? 0) * scale + ty;
      const r = Math.max(radius(n.score) * scale, 2.2) + 3;
      const d = Math.hypot(cx - mx, cy - my);
      if (d <= r && d < bestDist) {
        bestDist = d;
        best = { node: n, sx: cx, sy: cy };
      }
    }
    return best;
  }, [radius]);

  function onCanvasMove(e: React.MouseEvent) {
    const hit = hitTest(e.clientX, e.clientY);
    setHover(hit);
    setHoveredId(hit ? hit.node.id : null);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = hit ? "pointer" : "default";
  }
  function onCanvasLeave() {
    setHover(null);
    setHoveredId(null);
  }
  function onCanvasClick(e: React.MouseEvent) {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) router.push(`/key/${encodeURIComponent(hit.node.id)}`);
  }

  const drawnIsolated = view.nodes.filter((n) => n.isolated).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[color:var(--color-ink-dim)]">
          Drawing{" "}
          <span className="mono text-[color:var(--color-ink)]">
            {view.nodes.length.toLocaleString("en-US")}
          </span>{" "}
          keys and{" "}
          <span className="mono text-[color:var(--color-ink)]">
            {view.edges.length.toLocaleString("en-US")}
          </span>{" "}
          reply edges.
          {settling && (
            <span className="ml-2 text-[color:var(--color-ink-faint)]">settling the layout…</span>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--color-ink-dim)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[color:var(--color-flag)]"
            checked={isolatedOnly}
            onChange={(e) => {
              setIsolatedOnly(e.target.checked);
              setHover(null);
              setHoveredId(null);
              setFocusedId(null);
            }}
          />
          Isolated clusters only
          <span className="mono text-[color:var(--color-ink-faint)]">
            ({isolatedTotal.toLocaleString("en-US")})
          </span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div ref={wrapRef} className="card relative overflow-hidden p-2">
          {view.nodes.length === 0 ? (
            <div className="flex h-[560px] items-center justify-center px-6 text-center text-sm text-[color:var(--color-ink-faint)]">
              No isolated cluster survives to this snapshot&apos;s top keys, so there is nothing to
              draw here. Clear the filter to see the whole export.
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseMove={onCanvasMove}
              onMouseLeave={onCanvasLeave}
              onClick={onCanvasClick}
              role="img"
              aria-label={`Reply network graph. ${view.nodes.length} did:key nodes and ${view.edges.length} reply edges. Use the key list beside it to reach a node by keyboard.`}
              className="block h-[560px] w-full"
            />
          )}

          {hover && (
            <div
              className="pointer-events-none absolute z-30 w-56 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-3 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(hover.sx + 14, 8), width - 232),
                top: Math.min(hover.sy + 14, HEIGHT - 130),
              }}
            >
              <div className="mono text-[color:var(--color-ink)]">{hover.node.short}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[color:var(--color-ink-dim)]">
                <dt>Score</dt>
                <dd className="mono text-right text-[color:var(--color-ink)]">
                  {hover.node.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </dd>
                <dt>Cluster</dt>
                <dd className="mono text-right text-[color:var(--color-ink)]">
                  {hover.node.cluster}
                </dd>
                <dt>Signed</dt>
                <dd
                  className="text-right"
                  style={{
                    color: hover.node.signed
                      ? "var(--color-signal)"
                      : "var(--color-ink-faint)",
                  }}
                >
                  {hover.node.signed ? "yes" : "nickname"}
                </dd>
                <dt>Isolated</dt>
                <dd
                  className="text-right"
                  style={{ color: hover.node.isolated ? FLAG : "var(--color-signal)" }}
                >
                  {hover.node.isolated ? "yes" : "no"}
                </dd>
              </dl>
              <div className="mt-2 text-[color:var(--color-ink-faint)]">Click to open the profile</div>
            </div>
          )}
        </div>

        {/* The parallel list is the keyboard path into the graph. Focus a row to light
            that node and its neighbors on the canvas, Enter or click to open the key. */}
        <div className="card flex flex-col p-3">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            Keys by score
          </div>
          <ul className="mt-2 max-h-[520px] space-y-1 overflow-y-auto pr-1" aria-label="Keys in the graph, highest score first">
            {nodesByScore.map((n) => {
              const active = n.id === (hoveredId ?? focusedId);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onFocus={() => setFocusedId(n.id)}
                    onBlur={() => setFocusedId((cur) => (cur === n.id ? null : cur))}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => router.push(`/key/${encodeURIComponent(n.id)}`)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none transition-colors hover:bg-[color:var(--color-panel-2)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal)]"
                    style={active ? { background: "var(--color-panel-2)" } : undefined}
                    aria-label={`${n.short}, score ${n.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}, cluster ${n.cluster}${n.isolated ? ", isolated" : ""}${n.signed ? ", signed" : ", nickname"}. Open profile.`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: nodeColor(n) }}
                      aria-hidden="true"
                    />
                    <span className="mono truncate text-[color:var(--color-ink)]">{n.short}</span>
                    <span className="mono ml-auto tabular-nums text-[color:var(--color-ink-faint)]">
                      {n.score.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    {n.isolated && (
                      <span
                        className="rounded px-1 text-[10px] font-medium"
                        style={{ background: "rgba(255,92,108,0.15)", color: FLAG }}
                      >
                        iso
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            Legend
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: CONNECTED_PALETTE[0] }}
              />
              <span className="text-[color:var(--color-ink-dim)]">
                Connected key, colored by cluster in the signal-green and cool family
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: FLAG }} />
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
            {drawnIsolated.toLocaleString("en-US")} of{" "}
            {view.nodes.length.toLocaleString("en-US")} keys drawn sit in an isolated cluster (
            {percent(drawnIsolated / (view.nodes.length || 1))}).
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
