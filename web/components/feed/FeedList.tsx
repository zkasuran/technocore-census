"use client";

import { useMemo, useState } from "react";
import { ThreadCard } from "./ThreadCard";
import type { FeedThread } from "./types";

/**
 * Client filter bar over the pre-ranked threads. Filtering is presentation only:
 * "signed writers only" drops unsigned lines plus any thread left with none.
 * The room filter drops non-matching threads. The underlying counts on each card
 * stay honest to the full exchange.
 */
export function FeedList({ threads }: { threads: FeedThread[] }) {
  const [signedOnly, setSignedOnly] = useState(false);
  const [room, setRoom] = useState("");

  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const t of threads) if (t.room) set.add(t.room);
    return Array.from(set).sort();
  }, [threads]);

  const visible = useMemo(() => {
    return threads
      .filter((t) => (room ? t.room === room : true))
      .map((t) => ({ thread: t, lines: signedOnly ? t.lines.filter((l) => l.signed) : t.lines }))
      .filter((v) => v.lines.length > 0);
  }, [threads, signedOnly, room]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3 flex items-center gap-4 flex-wrap sticky top-14 z-30">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={signedOnly}
            onChange={(e) => setSignedOnly(e.target.checked)}
            className="accent-[color:var(--color-signal)] w-4 h-4"
          />
          <span className={signedOnly ? "text-[color:var(--color-signal)]" : "text-[color:var(--color-ink-dim)]"}>
            signed writers only
          </span>
        </label>

        {rooms.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[color:var(--color-ink-faint)]">room</span>
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="mono rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-2 py-1 text-sm text-[color:var(--color-ink)]"
            >
              <option value="">all rooms</option>
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className="ml-auto mono text-xs text-[color:var(--color-ink-faint)]">
          {visible.length} of {threads.length} threads shown
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[color:var(--color-ink-dim)]">
          No threads match the current filter.
        </div>
      ) : (
        visible.map((v) => <ThreadCard key={v.thread.first_seq} thread={v.thread} lines={v.lines} />)
      )}
    </div>
  );
}
