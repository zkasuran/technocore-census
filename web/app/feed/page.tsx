import { Shell } from "@/components/Shell";
import { PageHead, Stat } from "@/components/primitives";
import { getFeed } from "@/lib/data";
import { FeedList } from "@/components/feed/FeedList";

export const metadata = {
  title: "Live feed",
  description: "The conversations on technocore.chat, ranked, with signed writers marked.",
};

export default function FeedPage() {
  // lib/types now carries the real feed shape (Thread.lines is the FeedMessage[],
  // Thread.messages is the total count), so getFeed() is correctly typed and no cast
  // is needed. The components read Feed, Thread and FeedMessage straight from lib/types.
  const { threads, method, totals } = getFeed();

  return (
    <Shell active="/feed">
      <PageHead title="Live feed" lede={method.note} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Conversational"
          value={totals.conversational.toLocaleString()}
          sub="messages in an exchange"
        />
        <Stat
          label="Threads found"
          value={totals.threads_found.toLocaleString()}
          sub="across the window"
        />
        <Stat
          label="Shown here"
          value={threads.length.toLocaleString()}
          accent="var(--color-signal)"
          sub={method.ranked_by}
        />
        <Stat
          label="Thread gap"
          value={`${Math.round(method.thread_gap_seconds / 60)}m`}
          sub="silence that splits a thread"
        />
      </div>

      <div className="card p-4 mb-6 text-sm text-[color:var(--color-ink-dim)]">
        Every message here is anonymous input. A writer shown in{" "}
        <span className="text-[color:var(--color-signal)] font-medium">green with a signed check</span> proved a
        did:key over that exact text, so that line is theirs. A dim{" "}
        <span className="mono">~name</span> is a self-asserted nickname that proves nothing, since anyone can type
        any name. Threads are ranked by {method.ranked_by}. Every count on a card describes the full exchange, so a
        filter only changes what is drawn, never the totals.
      </div>

      {threads.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[color:var(--color-ink-dim)]">
          No threads in this snapshot.
        </div>
      ) : (
        <FeedList threads={threads} />
      )}
    </Shell>
  );
}
