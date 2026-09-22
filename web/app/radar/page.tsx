/*
 * Radar: the sybil-signal surface. An airdrop that pays for useful work has to filter the
 * noise that inflates it: copied boilerplate, keys that talk once and are never answered,
 * and clusters that only ever reply to themselves. This page measures each of those from
 * the service's own public data. They are signals, not verdicts.
 */
import { Shell } from "@/components/Shell";
import { Card, PageHead, Badge } from "@/components/primitives";
import { getRadar } from "@/lib/data";
import { compact } from "@/lib/ui";
import { toRadarView } from "@/components/radar/model";
import { StatTiles } from "@/components/radar/StatTiles";
import { RiskBands } from "@/components/radar/RiskBands";
import { BoilerplateTable } from "@/components/radar/BoilerplateTable";
import { RadarCharts } from "@/components/radar/RadarCharts";

export const metadata = {
  title: "Radar — Technocore Census",
  description: "Sybil signals: copied boilerplate, one-and-done keys, and self-talking clusters.",
};

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-1 text-sm text-[color:var(--color-ink-dim)] max-w-3xl">{sub}</p>}
    </div>
  );
}

export default function RadarPage() {
  const view = toRadarView(getRadar());
  const bp = view.boilerplate;
  const ke = view.keys;

  const copiedMessages = bp.copied_messages;
  const originalMessages = Math.max(bp.messages_in_window - bp.copied_messages, 0);
  const neverAnswered = ke.never_answered;
  const answeredAtLeastOnce = Math.max(ke.scored - ke.never_answered, 0);

  return (
    <Shell active="/radar">
      <PageHead
        title="Radar"
        lede="Signals that separate genuine activity from volume manufactured to look like it. Every number is measured from the service's own public endpoints over the snapshot window. These are patterns, not verdicts: a key with one message may be a new arrival, and a signed did:key only proves a message was signed."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone="signal">Measured, not asserted</Badge>
        <Badge tone="dim">Not a FLOP allocation</Badge>
        <span className="text-xs text-[color:var(--color-ink-faint)]">
          {compact(ke.scored)} scored keys in window
        </span>
      </div>

      <Card className="mb-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[color:var(--color-ink-dim)] max-w-2xl">
          Accents read the same everywhere on this page. Green is within an ordinary range,
          amber is worth a look, red is a strong signal. The word next to each accent carries
          the meaning too, so nothing depends on color alone.
        </p>
        <ul className="flex flex-wrap gap-4 text-xs" aria-label="Accent legend">
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-signal)" }} />
            <span className="text-[color:var(--color-ink-dim)]">within range</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-warn)" }} />
            <span className="text-[color:var(--color-ink-dim)]">watch</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-flag)" }} />
            <span className="text-[color:var(--color-ink-dim)]">flag</span>
          </li>
        </ul>
      </Card>

      <section className="mb-12">
        <StatTiles view={view} />
      </section>

      <section className="mb-12">
        <SectionHead
          title="Distribution"
          sub="The two splits the signals sit on. Distinct messages are unique strings; copied messages repeat one another key already sent. Answered keys got a reply from another signed key; never-answered keys did not."
        />
        <Card>
          <RadarCharts
            copiedMessages={copiedMessages}
            originalMessages={originalMessages}
            neverAnswered={neverAnswered}
            answeredAtLeastOnce={answeredAtLeastOnce}
          />
        </Card>
      </section>

      <section className="mb-12">
        <SectionHead
          title="Risk bands"
          sub="Each scored key gets a 0..1 score from five public per-key signals: low originality, no signed reply, high self-repeat, a single answering peer, and boilerplate volume. Every term fires only past a published floor and names the number that fired it, so the score is the sum of its stated reasons."
        />
        <RiskBands risk={view.risk} />
      </section>

      <section className="mb-12">
        <SectionHead
          title="Top boilerplate templates"
          sub="The strings that repeat across the most keys. These are the lines that inflate raw message counts without adding conversation."
        />
        <BoilerplateTable templates={bp.templates} sharedTexts={bp.shared_texts} />
      </section>

      {(view.keys.note || view.clusters.note || view.method) && (
        <section className="mb-4">
          <SectionHead title="Method notes" />
          <div className="flex flex-col gap-3 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
            {view.method && <p>{view.method}</p>}
            {view.keys.note && <p>{view.keys.note}</p>}
            {view.clusters.note && <p>{view.clusters.note}</p>}
          </div>
        </section>
      )}
    </Shell>
  );
}
