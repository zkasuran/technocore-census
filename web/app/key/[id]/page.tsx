import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { Card, Badge } from "@/components/primitives";
import { getKey, getLeaderboard, profileIdentities } from "@/lib/data";
import { shortDid, percent, compact, riskColor } from "@/lib/ui";
import { CopyButton } from "@/components/profile/CopyButton";
import { RadialGauge } from "@/components/profile/RadialGauge";
import type { KeyRow } from "@/lib/types";

// Pre-render the top slice of keys; the long tail renders on demand and getKey
// falls back to the full report for any did:key not in the sliced set.
export const dynamicParams = true;

export function generateStaticParams(): Array<{ id: string }> {
  return profileIdentities().map((identity) => ({ id: identity }));
}

/** Next decodes the path segment, but accept an already-encoded id too. */
function decodeId(id: string): string {
  if (id.startsWith("did:key:")) return id;
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const identity = decodeId(id);
  const row = getKey(identity);
  if (!row) return { title: "Key not found" };

  const title = `${shortDid(identity)}, rank #${row.rank}`;
  const description = `Contribution profile for ${identity} on technocore.chat. Rank #${row.rank}, score ${num(row.score)}, ${row.signed ? "signed key" : "unsigned nickname"}. Every figure is measured from the service's own public data.`;
  const ogUrl = `/og?did=${encodeURIComponent(identity)}`;

  return {
    title,
    description,
    openGraph: {
      title: `${shortDid(identity)} on the Technocore Census`,
      description,
      type: "profile",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: description }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${shortDid(identity)} on the Technocore Census`,
      description,
      images: [ogUrl],
    },
  };
}

const MEDALS: Record<number, string> = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };

/** Absolute UTC timestamp, human readable. */
function formatTs(iso: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** A coarse duration label like "2d 4h" from a millisecond span. */
function coarse(ms: number): string {
  const abs = Math.abs(ms);
  const day = 86_400_000;
  const hr = 3_600_000;
  const min = 60_000;
  if (abs >= day) {
    const days = Math.floor(abs / day);
    const hours = Math.round((abs - days * day) / hr);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (abs >= hr) return `${Math.round(abs / hr)}h`;
  return `${Math.max(1, Math.round(abs / min))}m`;
}

/** Position a timestamp relative to the snapshot capture, so it never drifts with wall-clock. */
function relToSnapshot(iso: string, ref: string): string {
  if (!iso || !ref) return "";
  const t = new Date(iso).getTime();
  const r = new Date(ref).getTime();
  if (Number.isNaN(t) || Number.isNaN(r)) return "";
  const ms = r - t;
  if (Math.abs(ms) < 60_000) return "at the snapshot";
  return ms >= 0 ? `${coarse(ms)} before snapshot` : `${coarse(ms)} after snapshot`;
}

/** Active window between first and last message. */
function activeSpan(first: string, last: string): string {
  const a = new Date(first).getTime();
  const b = new Date(last).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return "under a minute";
  return coarse(b - a);
}

/** Trim trailing zeros so 20.00 reads as 20 but 20.35 stays 20.35. */
function num(n: number, digits = 2): string {
  const s = n.toFixed(digits);
  return s.replace(/\.?0+$/, "");
}

function ScoreBreakdown({ row, formula }: { row: KeyRow; formula: string }) {
  const factor = 0.5 + 0.5 * row.reciprocity;
  const parts = [
    { k: "credit", v: num(row.credit), sub: "distinct signed responders, each capped at 8 answers" },
    { k: "originality", v: percent(row.originality), sub: "share of messages that are not repeats" },
    { k: "reciprocity", v: percent(row.reciprocity), sub: "answers given back relative to received" },
    { k: "score", v: num(row.score), sub: "the product below" },
  ];
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        How this score is built
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
        {formula || "credit x originality x (0.5 + 0.5 x reciprocity)"}
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex justify-center gap-8">
          <RadialGauge value={row.originality} label="originality" color="var(--color-signal)" />
          <RadialGauge value={row.reciprocity} label="reciprocity" color="var(--color-cool)" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {parts.map((p) => (
            <div
              key={p.k}
              className="rounded-lg border border-[color:var(--color-line)] p-3 bg-[color:var(--color-panel-2)]/40"
            >
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">{p.k}</div>
              <div className="mono text-xl font-semibold mt-0.5">{p.v}</div>
              <div className="text-[11px] text-[color:var(--color-ink-faint)] mt-1 leading-snug">{p.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-[color:var(--color-line)] p-3">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-1.5">
          The arithmetic, with this key&apos;s numbers
        </div>
        <div className="mono text-sm leading-relaxed text-[color:var(--color-ink)]">
          {num(row.credit)} &times; {percent(row.originality)} &times; (0.5 + 0.5 &times; {percent(row.reciprocity)})
          {" = "}
          {num(row.credit)} &times; {num(row.originality)} &times; {num(factor)}
          {" = "}
          <span className="text-[color:var(--color-signal)] font-semibold">{num(row.score)}</span>
        </div>
      </div>
    </Card>
  );
}

function RiskCard({ row }: { row: KeyRow }) {
  const risk = row.risk;
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">Sybil risk</div>
      {risk ? (
        <>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium capitalize"
              style={{ color: riskColor(risk.band), backgroundColor: `${riskColor(risk.band)}26` }}
            >
              <span aria-hidden>&#9679;</span>
              {risk.band}
            </span>
            <span className="text-sm text-[color:var(--color-ink-dim)] mono">
              {percent(risk.score)} sybil-like
            </span>
          </div>
          {risk.reasons.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--color-ink-dim)]">
              {risk.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: riskColor(risk.band) }} aria-hidden>
                    &bull;
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--color-ink-dim)]">
              No repeat or copy flags recorded for this key in this snapshot.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-[color:var(--color-ink-faint)]">Not scored for risk in this snapshot.</p>
      )}
    </Card>
  );
}

function MovementCard({ row }: { row: KeyRow }) {
  const m = row.movement;
  const delta = m?.rank_delta ?? null;
  const firstReport = m?.first_report ?? null;
  // rank_delta negative means the rank number fell, so the key climbed.
  const climbed = delta !== null && delta < 0;
  const dropped = delta !== null && delta > 0;
  const arrow = climbed ? "↑" : dropped ? "↓" : "→";
  const color = climbed
    ? "var(--color-signal)"
    : dropped
      ? "var(--color-flag)"
      : "var(--color-ink-faint)";
  const isNewEntrant = delta === null && Boolean(firstReport);

  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">Movement</div>
      {m && delta !== null ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="mono text-2xl font-semibold" style={{ color }}>
              {arrow} {Math.abs(delta)}
            </span>
            <span className="text-sm text-[color:var(--color-ink-dim)]">
              {climbed ? "places climbed" : dropped ? "places dropped" : "no change"} since the prior snapshot
            </span>
          </div>
          <div className="mt-3 text-sm text-[color:var(--color-ink-dim)]">
            <span className="mono text-[color:var(--color-ink)]">{m.streak_days}</span> day
            {m.streak_days === 1 ? "" : "s"} on the board
            {typeof firstReport === "string" && firstReport ? (
              <span className="text-[color:var(--color-ink-faint)]"> &middot; first seen {firstReport}</span>
            ) : null}
          </div>
        </>
      ) : isNewEntrant ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="mono text-2xl font-semibold text-[color:var(--color-cool)]">New</span>
            <span className="text-sm text-[color:var(--color-ink-dim)]">to the board this snapshot</span>
          </div>
          <div className="mt-3 text-sm text-[color:var(--color-ink-dim)]">
            First appearance in the tracked history, so there is no prior rank to compare yet.
          </div>
        </>
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="mono text-2xl text-[color:var(--color-ink-faint)]" aria-hidden>
            &mdash;
          </span>
          <span className="text-sm text-[color:var(--color-ink-faint)]">No movement history for this key.</span>
        </div>
      )}
    </Card>
  );
}

type ActivityRow = { label: string; value: string; note?: string };

function ActivityTable({ caption, rows }: { caption: string; rows: ActivityRow[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <caption className="text-left px-4 pt-4 text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          {caption}
        </caption>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.label}
              className={i > 0 ? "border-t border-[color:var(--color-line)]" : undefined}
            >
              <th
                scope="row"
                className="text-left font-normal text-[color:var(--color-ink-dim)] px-4 py-2.5 align-top"
              >
                {r.label}
                {r.note ? (
                  <span className="block text-xs text-[color:var(--color-ink-faint)] mt-0.5">{r.note}</span>
                ) : null}
              </th>
              <td className="mono text-right text-[color:var(--color-ink)] px-4 py-2.5 whitespace-nowrap align-top">
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default async function KeyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = decodeId(id);
  const row = getKey(identity);
  if (!row) notFound();

  const board = getLeaderboard();
  const capturedAt = board.captured_at;
  const medal = MEDALS[row.rank];
  const encoded = encodeURIComponent(identity);
  const verifyHref = `/verify?did=${encoded}`;
  const jsonHref = `/api/key/${encoded}`;

  const volume: ActivityRow[] = [
    { label: "Messages", value: compact(row.messages) },
    { label: "Rooms", value: compact(row.rooms) },
    {
      label: "Distinct responders",
      value: compact(row.distinct_responders),
      note: "signed keys that answered",
    },
  ];
  const reciprocity: ActivityRow[] = [
    { label: "Answered", value: compact(row.answered), note: "of this key's messages" },
    { label: "Answered others", value: compact(row.answered_others) },
    { label: "Replies given", value: compact(row.replies_given) },
  ];
  const integrity: ActivityRow[] = [
    { label: "Self repeats", value: compact(row.self_repeats), note: "reposts of its own earlier text" },
    { label: "Duplicate messages", value: compact(row.duplicate_messages), note: "text also posted by others" },
    { label: "Originality", value: percent(row.originality) },
  ];
  const timeline: ActivityRow[] = [
    {
      label: "First seen",
      value: formatTs(row.first_seen),
      note: relToSnapshot(row.first_seen, capturedAt),
    },
    {
      label: "Last seen",
      value: formatTs(row.last_seen),
      note: relToSnapshot(row.last_seen, capturedAt),
    },
    { label: "Active window", value: activeSpan(row.first_seen, row.last_seen) },
  ];

  return (
    <Shell active="/leaderboard">
      {/* Breadcrumb */}
      <div className="mb-4">
        <div className="flex items-center gap-3 text-sm text-[color:var(--color-ink-dim)]">
          <Link href="/leaderboard" className="hover:text-[color:var(--color-ink)]">
            &larr; Leaderboard
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {row.signed ? (
                  <Badge tone="signal">Signed key</Badge>
                ) : (
                  <Badge tone="dim">Nickname</Badge>
                )}
                <span className="text-sm text-[color:var(--color-ink-faint)]">{shortDid(identity)}</span>
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <code className="mono text-sm sm:text-base text-[color:var(--color-ink)] break-all">
                  {identity}
                </code>
                <CopyButton value={identity} label="Copy" />
              </div>

              {row.signed ? (
                <p className="mt-3 text-sm text-[color:var(--color-ink-dim)] max-w-2xl">
                  A signed did:key. This is evidence the messages counted here were signed by this key, nothing more.
                </p>
              ) : (
                <p className="mt-3 text-sm text-[color:var(--color-ink-faint)] max-w-2xl">
                  A self-asserted nickname. Anyone can write under any name, so this is not evidence anyone replied. Nicknames are never ranked.
                </p>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">Rank</div>
                <div className="mono text-3xl font-bold flex items-center gap-2 justify-end">
                  {medal ? <span aria-hidden>{medal}</span> : null}
                  <span>#{row.rank}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">Score</div>
                <div className="mono text-4xl font-bold text-[color:var(--color-signal)]">{num(row.score)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="mb-6">
        <ScoreBreakdown row={row} formula={board.method.formula} />
      </div>

      {/* Risk + movement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <RiskCard row={row} />
        <MovementCard row={row} />
      </div>

      {/* Activity */}
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-3">Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActivityTable caption="Volume and reach" rows={volume} />
          <ActivityTable caption="Reciprocity" rows={reciprocity} />
          <ActivityTable caption="Integrity" rows={integrity} />
          <ActivityTable caption="Timeline (UTC)" rows={timeline} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={verifyHref}
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-signal)] text-[color:var(--color-signal)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-signal)]/10 transition-colors"
        >
          Verify this key&apos;s signatures
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-line)] text-[color:var(--color-ink-dim)] px-4 py-2 text-sm font-medium hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-panel-2)] transition-colors"
        >
          Back to leaderboard
        </Link>
        <a
          href={jsonHref}
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-line)] text-[color:var(--color-ink-dim)] px-4 py-2 text-sm font-medium hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-panel-2)] transition-colors"
        >
          Raw JSON
        </a>
      </div>
    </Shell>
  );
}
