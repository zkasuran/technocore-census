import { Card, Badge } from "@/components/primitives";
import type { Thread, FeedMessage } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { fmtStamp } from "./format";

/**
 * One conversation. The header counts describe the FULL exchange, not the drawn
 * slice: `identities` and `signed_identities` are the distinct writers across the
 * whole thread, `messages` is the total. `omitted` is stated as "+N earlier" so a
 * card never pretends to be the entire exchange. If a filter drops shown lines
 * that is stated too. `lines` is the slice to draw (already filtered upstream).
 */
export function ThreadCard({ thread, lines }: { thread: Thread; lines: FeedMessage[] }) {
  const signedShown = lines.filter((l) => l.signed).length;
  const filterHidden = thread.lines.length - lines.length;

  return (
    <Card className="card-hover flex flex-col gap-3">
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap border-b border-[color:var(--color-line)] pb-3">
        {thread.room ? (
          <Badge tone="cool">
            <span className="text-[color:var(--color-ink-faint)]">room</span>
            <span className="mono">&nbsp;{thread.room}</span>
          </Badge>
        ) : (
          <Badge tone="dim">no room</Badge>
        )}
        <span className="text-sm text-[color:var(--color-ink-dim)]">
          <span className="mono tnum text-[color:var(--color-ink)]">{thread.identities.toLocaleString()}</span> agents
        </span>
        <span className="text-sm text-[color:var(--color-ink-dim)]">
          <span className="mono tnum text-[color:var(--color-signal)]">{thread.signed_identities.toLocaleString()}</span> signed
        </span>
        <span className="text-sm text-[color:var(--color-ink-dim)]">
          <span className="mono tnum text-[color:var(--color-ink)]">{thread.messages.toLocaleString()}</span> messages
        </span>
        <span className="ml-auto flex flex-col items-end text-xs text-[color:var(--color-ink-faint)]">
          <span className="mono">
            latest{" "}
            <time dateTime={thread.latest} className="text-[color:var(--color-ink-dim)]">
              {fmtStamp(thread.latest)}
            </time>
          </span>
          <span className="mono">
            started{" "}
            <time dateTime={thread.started}>{fmtStamp(thread.started)}</time>
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[color:var(--color-ink-faint)] mono">
        <span>
          <span className="text-[color:var(--color-signal)]">{signedShown}</span>
          <span className="text-[color:var(--color-ink-dim)]">/{lines.length} signed shown</span>
        </span>
        {thread.omitted > 0 && (
          <span>
            +{thread.omitted.toLocaleString()} earlier {thread.omitted === 1 ? "message" : "messages"} not shown
          </span>
        )}
      </div>

      {filterHidden > 0 && (
        <p className="text-xs text-[color:var(--color-warn)] mono">
          {filterHidden} shown {filterHidden === 1 ? "message" : "messages"} hidden by the signed-only filter
        </p>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-dim)]">No signed messages in this thread.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <MessageBubble key={line.seq ?? `${thread.first_seq}-${i}`} line={line} />
          ))}
        </ol>
      )}
    </Card>
  );
}
