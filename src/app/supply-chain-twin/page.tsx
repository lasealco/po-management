import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet } from "@/lib/authz";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import { resolveNavState } from "@/lib/nav-visibility";
import { getSupplyChainTwinReadinessSnapshot } from "@/lib/supply-chain-twin/readiness";

import { TwinEntitiesSection } from "./twin-entities-section";

export const dynamic = "force-dynamic";

const DOCS_TREE =
  "https://github.com/lasealco/po-management/tree/main/docs/sctwin";
const README_BLOB =
  "https://github.com/lasealco/po-management/blob/main/docs/sctwin/README.md";

export const metadata: Metadata = {
  title: "Supply Chain Twin — AR SCMP",
  description:
    "Preview shell for the AI-driven Supply Chain Twin — cross-module intelligence over POs, logistics, warehouse, and commercial data.",
};

const PLANNED_SURFACES = [
  "Twin overview dashboard (health, risks, demand vs supply coverage)",
  "Twin explorer (graph, timeline, linked entities, source references)",
  "Product / SKU, supplier, shipment, and order fulfillment twin views",
  "Scenario workspace and alert / recommendation center",
  "Natural-language assistant over the twin (permission-aware)",
] as const;

export default async function SupplyChainTwinHomePage() {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  if (!access?.user) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="Choose an active demo user in Settings → Demo session, then return here."
      />
    );
  }

  if (!linkVisibility?.supplyChainTwin) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="This preview is available for workspace sessions with cross-module access. Try a broader demo role or open the platform hub."
      />
    );
  }

  const readiness = getSupplyChainTwinReadinessSnapshot();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Module preview</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">Supply Chain Twin</h1>
      <p className="mt-3 max-w-2xl text-base text-zinc-600">
        A cross-module intelligence layer — not a separate transactional system. It is the live digital model of
        supply, demand, inventory, transport, cost, and risk, with AI services on top. Implementation follows the
        developer pack in{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">docs/sctwin</code>.
      </p>

      {!readiness.ok ? (
        <aside
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <p className="font-semibold text-amber-900">Twin module is not fully ready</p>
          {readiness.reasons.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
              {readiness.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-amber-900/90">See operator notes in the developer pack or contact support.</p>
          )}
          <p className="mt-3">
            <a href={README_BLOB} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              docs/sctwin README
            </a>
            <span className="mx-2 text-amber-800/60">·</span>
            <a href={DOCS_TREE} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              Full spec tree on GitHub
            </a>
          </p>
        </aside>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={DOCS_TREE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
        >
          Open docs on GitHub
        </a>
        <a
          href={README_BLOB}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
        >
          README →
        </a>
        <Link
          href={PLATFORM_HUB_PATH}
          className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          ← Platform hub
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">What ships after this shell</h2>
        <p className="mt-2 text-sm text-zinc-600">
          The functional PRD lists main screens; engineering order starts with the graph object model, ingestion
          events, and state engines before UI depth.
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-zinc-700">
          {PLANNED_SURFACES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <TwinEntitiesSection />

      <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Status</p>
        <p className="mt-2">
          This route is a <span className="font-medium text-zinc-800">placeholder</span> so investors and buyers see
          the module on the roadmap. No twin graph, ingestion, or KPI jobs run here yet.
        </p>
      </section>
    </main>
  );
}
