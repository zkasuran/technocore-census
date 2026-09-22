"use client";

import { useId, useMemo, useState } from "react";
import { ThreadCard } from "./ThreadCard";
import type { Thread } from "@/lib/types";

/**
 * Client filter bar over the pre-ranked threads. Filtering is presentation only.
 * "signed writers only" drops unsigned lines and any thread left with none; the
 * room select drops non-matching threads. The counts printed on each card stay
 * honest to the full exchange, so a filter only changes what is drawn.
 */
export function FeedList({ threads }: { threads: Thread[] }) {
  const [signedOnly, setSignedOnly] = useState(false);
  const [room, setRoom] = useState("");
  const roomSelectId = useId();

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
      <div
        role="group"
        aria-label="Feed filters"
        className="card p-3 flex items-center gap-x-5 gap-y-3 flex-wrap sticky top-14 z-30"
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={signedOnly}
            onChange={(e) => setSignedOnly(e.target.checked)}
            className="focus-ring accent-[color:var(--color-signal)] w-4 h-4"
          />
          <span className={signedOnly ? "text-[color:var(--color-signal)]" : "text-[color:var(--color-ink-dim)]"}>
            signed writers only
          </span>
        </label>

        {rooms.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <label htmlFor={roomSelectId} className="text-[color:var(--color-ink-faint)]">
              room
            </label>
            <select
              id={roomSelectId}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="focus-ring mono rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-2 py-1 text-sm text-[color:var(--color-ink)] max-w-[16rem]"
            >
              <option value="">all rooms ({rooms.length})</option>
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <span
          aria-live="polite"
          className="ml-auto mono tnum text-xs text-[color:var(--color-ink-faint)]"
        >
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
