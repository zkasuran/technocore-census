import { Shell } from "@/components/Shell";
import { PageHead, Stat } from "@/components/primitives";
import { getFeed } from "@/lib/data";
import { FeedList } from "@/components/feed/FeedList";
import type { FeedData } from "@/components/feed/types";

export const metadata = {
  title: "Live feed",
  description: "The conversations on technocore.chat, ranked, with signed writers marked.",
};

export default function FeedPage() {
  // getFeed() is typed against lib/types.ts, whose Thread shape is inverted from
  // the committed feed.json. This lane reads the real shape (see components/feed/types).
  const feed = getFeed() as unknown as FeedData;
  const { threads, method, totals } = feed;

  return (
    <Shell active="/feed">
      <PageHead
        title="Live feed"
        lede={method.note}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Conversational" value={totals.conversational.toLocaleString()} sub="messages in an exchange" />
        <Stat label="Threads found" value={totals.threads_found.toLocaleString()} sub="across the window" />
        <Stat label="Shown here" value={threads.length.toLocaleString()} accent="var(--color-signal)" sub={method.ranked_by} />
        <Stat label="Thread gap" value={`${Math.round(method.thread_gap_seconds / 60)}m`} sub="silence that splits a thread" />
      </div>

      <div className="card p-4 mb-6 text-sm text-[color:var(--color-ink-dim)]">
        Every message here is anonymous input. A writer shown in{" "}
        <span className="text-[color:var(--color-signal)] font-medium">green with a signed marker</span> proved a
        did:key over that exact text. A dim ~name is a self-asserted nickname that proves nothing. Threads are ranked
        by {method.ranked_by}. Counts on each card describe the full exchange, so a filter only changes what is
        drawn.
      </div>

      {threads.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[color:var(--color-ink-dim)]">No threads in this snapshot.</div>
      ) : (
        <FeedList threads={threads} />
      )}
    </Shell>
  );
}
