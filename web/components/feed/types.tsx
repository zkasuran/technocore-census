/*
 * Local feed types + helpers for the /feed lane.
 *
 * INTEGRATION NOTE: the committed public/data/feed.json does not match the
 * `Thread` shape in lib/types.ts. In the real data each thread carries `lines`
 * as the array of message objects (author, label, signed, text, ts, seq) and
 * `messages` as an integer total count, plus `signed_identities` and `started`.
 * lib/types.ts has these two inverted (messages: FeedMessage[], lines: number)
 * and names the writer field `from` rather than `author`/`label`. This lane owns
 * no shared file, so it declares the real shape here and casts getFeed(). When
 * lib/types.ts is corrected, drop these and use the shared types.
 */

export interface FeedLine {
  author: string;
  label: string;
  signed: boolean;
  text: string;
  ts: string;
  seq?: number;
}

export interface FeedThread {
  first_seq: number;
  last_seq: number;
  identities: number;
  signed_identities?: number;
  latest: string;
  started?: string;
  lines: FeedLine[];
  messages: number; // total messages in the exchange, before truncation
  omitted: number;
  room?: string;
}

export interface FeedData {
  threads: FeedThread[];
  method: { note: string; ranked_by: string; thread_gap_seconds: number };
  totals: { conversational: number; threads_found: number };
}

/**
 * Deterministic UTC timestamp formatter. No Date parsing and no locale, so the
 * server HTML and the client hydration render byte-identical strings.
 * "2026-09-21T09:58:10.790428Z" -> "2026-09-21 09:58 UTC"
 */
export function fmtTs(ts: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(ts);
  if (!m) return ts;
  return `${m[1]} ${m[2]} UTC`;
}

/** Same, with seconds, for a single message line. */
export function fmtTime(ts: string): string {
  const m = /T(\d{2}:\d{2}:\d{2})/.exec(ts);
  return m ? `${m[1]}Z` : ts;
}
