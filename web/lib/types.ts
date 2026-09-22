/*
 * The data contract. Mirrors the Python report.json exactly, plus the fields the
 * next-level features add. Every surface reads these types, so a change here is the
 * one place a backend and a frontend lane agree. Optional fields are ones a feature
 * lane fills in; treat them as possibly-absent.
 */

export interface KeyRow {
  identity: string;
  signed: boolean;
  rank: number;
  score: number;
  credit: number;
  messages: number;
  rooms: number;
  answered: number;
  answered_others: number;
  replies_given: number;
  distinct_responders: number;
  duplicate_messages: number;
  self_repeats: number;
  originality: number;
  reciprocity: number;
  first_seen: string;
  last_seen: string;

  // Added by feature lanes (optional until their pipeline runs):
  risk?: RiskScore;
  movement?: KeyMovement;
  badges?: string[];
}

export interface RiskScore {
  score: number; // 0..1, higher = more sybil-like
  band: "clear" | "watch" | "flag";
  reasons: string[];
}

export interface KeyMovement {
  rank_delta: number | null; // negative = climbed
  score_delta: number | null;
  first_report: string | null; // ISO date first seen in history
  streak_days: number;
}

export interface IndexMethod {
  formula: string;
  max_answers_per_responder: number;
  reply_distance: number;
  note: string;
}

export interface CensusIndex {
  keys: KeyRow[];
  nicknames: KeyRow[];
  method: IndexMethod;
  totals: Record<string, number>;
}

export interface Thread {
  first_seq: number;
  last_seq: number;
  identities: number;
  signed_identities: number;
  latest: string;
  started: string;
  lines: FeedMessage[]; // the message objects
  messages: number; // total count in the thread
  omitted: number;
  room?: string;
}

export interface FeedMessage {
  author: string; // did:key when signed, else the raw nickname
  label: string; // display label (short did or ~name)
  signed: boolean;
  text: string;
  ts: string;
  seq: number;
}

export interface Feed {
  threads: Thread[];
  method: { note: string; ranked_by: string; thread_gap_seconds: number };
  totals: { conversational: number; threads_found: number };
}

export interface Radar {
  boilerplate: {
    copied_messages: number;
    copied_share: number;
    distinct_texts: number;
    messages_in_window: number;
    shared_texts: number;
    top_templates: Array<{ sample: string; messages: number; identities: number }>;
  };
  claims: Record<string, unknown>;
  clusters: {
    components: number;
    edge_distance: number;
    isolated_clusters: number;
    isolated_message_share: number;
    keys_answered_by_one_peer_only: number;
    keys_in_graph?: number;
  };
  keys: {
    scored: number;
    never_answered: number;
    never_answered_share: number;
  };
}

export interface Census {
  base_url: string;
  captured_at: string;
  derived: Record<string, number | boolean | Record<string, unknown>>;
  service: Record<string, unknown>;
  window: Record<string, number>;
}

export interface Report {
  schema: string;
  generator: string;
  census: Census;
  index: CensusIndex;
  feed: Feed;
  radar: Radar;
  snapshot: Record<string, unknown>;
  // Filled by the backend feature pipeline; absent until it runs.
  network?: Network;
  history?: History;
}

// ---- feature-lane data (sliced by scripts/prepare-data.mjs) ----

export interface Leaderboard {
  captured_at: string;
  method: IndexMethod;
  totals: Record<string, number>;
  rows: KeyRow[]; // top slice; long tail via /api
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  dids_active: number;
  scored: number;
  rooms_total: number;
  copied_share: number;
  never_answered_share: number;
  top_score: number;
}

export interface History {
  points: HistoryPoint[];
  key_series?: Record<string, Array<{ date: string; rank: number; score: number }>>;
}

export interface NetworkNode {
  id: string;
  short: string;
  signed: boolean;
  score: number;
  cluster: number;
  isolated: boolean;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
}

export interface Network {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clusters: number;
  note: string;
}
