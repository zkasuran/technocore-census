/*
 * Local view model for the radar surface. The committed snapshot carries more fields
 * than the shared Radar type names (extra key counts, cluster notes, and an optional
 * risk block a scoring lane fills in later), so this file reads the real JSON shape and
 * normalizes it. These types live here rather than in lib/types.ts, which this lane does
 * not own; fold them in at integration if wanted.
 */
import type { Radar } from "@/lib/types";

export type Template = { text: string; count: number; keys: number };

export interface RadarRisk {
  bands?: { clear?: number; watch?: number; flag?: number };
  flagged_share?: number;
  method?: string;
}

export interface RadarView {
  boilerplate: {
    copied_messages: number;
    copied_share: number;
    distinct_texts: number;
    shared_texts: number;
    messages_in_window: number;
    templates: Template[];
  };
  clusters: {
    components: number;
    isolated_clusters: number;
    isolated_message_share: number;
    keys_answered_by_one_peer_only: number;
    keys_in_graph: number;
    note?: string;
  };
  keys: {
    scored: number;
    never_answered: number;
    never_answered_share: number;
    entirely_boilerplate?: number;
    note?: string;
  };
  method?: string;
  risk?: RadarRisk;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Read the raw radar JSON (which is wider than the shared type) into the view model. */
export function toRadarView(radar: Radar): RadarView {
  const r = radar as unknown as Record<string, Record<string, unknown>>;
  const bp = (r.boilerplate ?? {}) as Record<string, unknown>;
  const cl = (r.clusters ?? {}) as Record<string, unknown>;
  const ke = (r.keys ?? {}) as Record<string, unknown>;
  const method = (r.method ?? {}) as Record<string, unknown>;

  const rawTemplates = Array.isArray(bp.top_templates) ? (bp.top_templates as Record<string, unknown>[]) : [];
  const templates: Template[] = rawTemplates.map((t) => ({
    text: String(t.sample ?? t.text ?? ""),
    count: num(t.messages ?? t.count),
    keys: num(t.identities ?? t.keys),
  }));

  const risk = r.risk as Record<string, unknown> | undefined;

  return {
    boilerplate: {
      copied_messages: num(bp.copied_messages),
      copied_share: num(bp.copied_share),
      distinct_texts: num(bp.distinct_texts),
      shared_texts: num(bp.shared_texts),
      messages_in_window: num(bp.messages_in_window),
      templates,
    },
    clusters: {
      components: num(cl.components),
      isolated_clusters: num(cl.isolated_clusters),
      isolated_message_share: num(cl.isolated_message_share),
      keys_answered_by_one_peer_only: num(cl.keys_answered_by_one_peer_only),
      keys_in_graph: num(cl.keys_in_graph),
      note: typeof cl.note === "string" ? cl.note : undefined,
    },
    keys: {
      scored: num(ke.scored),
      never_answered: num(ke.never_answered),
      never_answered_share: num(ke.never_answered_share),
      entirely_boilerplate: ke.entirely_boilerplate !== undefined ? num(ke.entirely_boilerplate) : undefined,
      note: typeof ke.note === "string" ? ke.note : undefined,
    },
    method: typeof method.note === "string" ? method.note : undefined,
    risk: risk
      ? {
          bands: risk.bands as RadarRisk["bands"],
          flagged_share: risk.flagged_share !== undefined ? num(risk.flagged_share) : undefined,
          method: typeof risk.method === "string" ? risk.method : undefined,
        }
      : undefined,
  };
}
