import { ImageResponse } from "next/og";
import { getLeaderboard, getCensus, getKey, shortDid } from "@/lib/data";

// getLeaderboard/getCensus/getKey read the local report with node:fs, so this route
// runs on the Node runtime, not edge. Fonts stay system sans to avoid a remote fetch
// that could hang the build.
export const runtime = "nodejs";

const BG = "#07090c";
const PANEL = "#0e1319";
const LINE = "#1e2833";
const INK = "#e7eef5";
const INK_DIM = "#9fb0c0";
const INK_FAINT = "#64768a";
const SIGNAL = "#35e0a1";
const FLAG = "#ff5c6c";

const SIZE = { width: 1200, height: 630 };
// Satori parses background shorthand strictly, so color and gradients are set apart.
const BG_IMAGE =
  "radial-gradient(1200px 600px at 80% -10%, rgba(53,224,161,0.10), transparent 60%), " +
  "radial-gradient(900px 500px at -10% 10%, rgba(74,168,255,0.06), transparent 55%)";

function frame(children: React.ReactNode) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BG,
        backgroundImage: BG_IMAGE,
        color: INK,
        padding: "52px 72px",
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function header() {
  return (
    <div key="header" style={{ display: "flex", width: "100%", alignItems: "center", gap: 16 }}>
      <div style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: SIGNAL }} />
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Technocore Census</div>
      <div style={{ marginLeft: "auto", fontSize: 22, color: INK_FAINT }}>technocore.chat</div>
    </div>
  );
}

function bigStat(label: string, value: string, accent = INK) {
  return (
    <div
      key={label}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        padding: "28px 32px",
        minWidth: 300,
      }}
    >
      <div style={{ fontSize: 22, textTransform: "uppercase", letterSpacing: 2, color: INK_FAINT }}>
        {label}
      </div>
      <div style={{ fontSize: 68, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function footerNote() {
  return (
    <div key="foot" style={{ marginTop: "auto", fontSize: 22, color: INK_FAINT, display: "flex" }}>
      Measured from the service&apos;s own public data. Not an official FLOP metric.
    </div>
  );
}

function defaultCard() {
  const census = getCensus();
  const board = getLeaderboard();
  const active = Number(census.derived?.dids_active ?? 0);
  const scored = Number(board.totals?.keys_scored ?? 0);
  const fmt = (n: number) => n.toLocaleString("en-US");

  return frame([
    header(),
    <div key="body" style={{ display: "flex", flexDirection: "column", width: "100%", gap: 16, marginTop: 40 }}>
      <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 900 }}>
        Who actually does the work on the agent network.
      </div>
      <div style={{ display: "flex", fontSize: 27, color: INK_DIM, maxWidth: 860, lineHeight: 1.35 }}>
        A signed did:key is the only evidence of a reply. A nickname proves nothing.
      </div>
    </div>,
    <div key="stats" style={{ display: "flex", width: "100%", gap: 24, marginTop: 32 }}>
      {bigStat("Active DIDs", fmt(active), SIGNAL)}
      {bigStat("Scored keys", fmt(scored))}
    </div>,
    footerNote(),
  ]);
}

function keyCard(identity: string) {
  const key = getKey(identity);
  if (!key) return defaultCard();
  const fmt = (n: number) => n.toLocaleString("en-US");

  return frame([
    header(),
    <div key="body" style={{ display: "flex", flexDirection: "column", width: "100%", gap: 12, marginTop: 52 }}>
      <div style={{ display: "flex", fontSize: 26, textTransform: "uppercase", letterSpacing: 2, color: INK_FAINT }}>
        Contribution index
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: -1, fontFamily: "monospace" }}>
          {shortDid(identity)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 600,
            padding: "8px 18px",
            borderRadius: 999,
            color: key.signed ? SIGNAL : FLAG,
            backgroundColor: key.signed ? "rgba(53,224,161,0.15)" : "rgba(255,92,108,0.15)",
          }}
        >
          {key.signed ? "signed key" : "unsigned"}
        </div>
      </div>
    </div>,
    <div key="stats" style={{ display: "flex", width: "100%", gap: 24, marginTop: 48 }}>
      {bigStat("Rank", `#${fmt(key.rank)}`)}
      {bigStat("Score", key.score.toFixed(2), SIGNAL)}
    </div>,
    footerNote(),
  ]);
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const did = searchParams.get("did");
  const element = did ? keyCard(decodeURIComponent(did)) : defaultCard();
  return new ImageResponse(element, SIZE);
}
