import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/primitives";
import { getFullReport, getRadar } from "@/lib/data";
import type { Network } from "@/lib/types";
import { Graph } from "@/components/network/Graph";

// report.json gains a top-level `network` block once the backend lane ships it. The
// shared Report type does not declare it yet and this lane must not edit types.ts, so
// the field is read through a local widening. Integration note: add `network?: Network`
// to the Report interface in lib/types.ts when that pipeline lands.
function readNetwork(): Network | undefined {
  const report = getFullReport() as ({ network?: Network } | null);
  return report?.network;
}

export const metadata: Metadata = {
  title: "Network",
  description:
    "The reply graph of technocore.chat. Nodes are did:keys, edges are replies. Clusters that only answer themselves are exactly what an airdrop filter cuts. Measured from the service's own public data.",
};

const LEDE =
  "Who answers whom on technocore.chat. Every node is a did:key and every edge is a reply. The layout pulls keys that talk together into clusters. A cluster that only answers itself is the shape a sybil filter looks for, so it reads in the flag color. Measured from the service's own public data, never an official FLOP number.";

export default function NetworkPage() {
  const network = readNetwork();

  if (!network || network.nodes.length === 0) {
    // No network export in this snapshot yet. Explain the view and fall back to the
    // cluster counts the radar already measured, so the page is honest and useful.
    const clusters = getRadar().clusters;
    const components = clusters?.components;
    const isolated = clusters?.isolated_clusters;

    return (
      <Shell active="/network">
        <PageHead title="Reply network" lede={LEDE} />
        <div className="card p-6">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            No network export in this snapshot
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
            The network view draws who answers whom as a force-directed graph, one node per
            did:key and one edge per reply, so clusters that only talk to themselves stand out.
            This snapshot has no network export yet, so the graph is not drawn here. The cluster
            summary below is what the radar already measured from the same public data.
          </p>

          {(typeof components === "number" || typeof isolated === "number") && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 max-w-lg">
              {typeof components === "number" && (
                <div className="card p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Connected components
                  </div>
                  <div className="mono mt-1 text-3xl font-semibold text-[color:var(--color-ink)]">
                    {components.toLocaleString("en-US")}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-ink-dim)]">
                    Separate islands in the reply graph
                  </div>
                </div>
              )}
              {typeof isolated === "number" && (
                <div className="card p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                    Isolated clusters
                  </div>
                  <div
                    className="mono mt-1 text-3xl font-semibold"
                    style={{ color: isolated > 0 ? "var(--color-warn)" : "var(--color-signal)" }}
                  >
                    {isolated.toLocaleString("en-US")}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-ink-dim)]">
                    Groups that only answer themselves, what a filter cuts
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-[color:var(--color-ink-faint)]">
            A did:key signature is the only evidence of a reply. A self-asserted nickname proves
            nothing, so it never counts as an edge here.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell active="/network">
      <PageHead title="Reply network" lede={LEDE} />
      <Graph network={network} />
    </Shell>
  );
}
