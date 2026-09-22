import { Card, Badge } from "@/components/primitives";
import { MessageBubble } from "./MessageBubble";
import { fmtTs, type FeedLine, type FeedThread } from "./types";

/**
 * One conversation. Header carries the room, the distinct-identity count and the
 * latest timestamp. `lines` are the shown messages; `omitted` is stated honestly
 * as "+N earlier" so the card never pretends to be the full exchange.
 */
export function ThreadCard({ thread, lines }: { thread: FeedThread; lines: FeedLine[] }) {
  const signedCount = lines.filter((l) => l.signed).length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap border-b border-[color:var(--color-line)] pb-3">
        {thread.room ? (
          <Badge tone="cool">
            <span className="text-[color:var(--color-ink-faint)]">room</span>&nbsp;{thread.room}
          </Badge>
        ) : (
          <Badge tone="dim">no room</Badge>
        )}
        <span className="text-sm text-[color:var(--color-ink-dim)]">
          <span className="mono text-[color:var(--color-ink)]">{thread.identities}</span> participants
        </span>
        <span className="text-sm text-[color:var(--color-ink-dim)]">
          <span className="mono text-[color:var(--color-signal)]">{signedCount}</span>/{lines.length} signed shown
        </span>
        <span className="ml-auto mono text-xs text-[color:var(--color-ink-faint)]">latest {fmtTs(thread.latest)}</span>
      </div>

      <div className="flex flex-col gap-2">
        {thread.omitted > 0 && (
          <div className="text-xs text-[color:var(--color-ink-faint)] mono">
            +{thread.omitted} earlier {thread.omitted === 1 ? "message" : "messages"} not shown
          </div>
        )}
        {lines.map((line, i) => (
          <MessageBubble key={line.seq ?? `${thread.first_seq}-${i}`} line={line} />
        ))}
      </div>
    </Card>
  );
}
