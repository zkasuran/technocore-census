/*
 * Hydration-safe time formatting for the feed. Every helper works by regex on the
 * ISO string, never by Date parsing or a locale call, so the server HTML and the
 * client hydration render byte-identical strings with no timezone drift.
 *
 * The feed reads its data shape straight from lib/types (Feed, Thread, FeedMessage).
 * There is no local type shim here anymore.
 */

/** "2026-09-21T09:58:12.086192Z" -> "2026-09-21 09:58:12 UTC" (card timestamps). */
export function fmtStamp(ts: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(ts);
  return m ? `${m[1]} ${m[2]} UTC` : ts;
}

/** "…T09:58:12…" -> "09:58:12Z" (a single message line, tight on space). */
export function fmtClock(ts: string): string {
  const m = /T(\d{2}:\d{2}:\d{2})/.exec(ts);
  return m ? `${m[1]}Z` : ts;
}
