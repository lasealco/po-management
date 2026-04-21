import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { TwinScenariosDraftsPanel } from "@/components/supply-chain-twin/twin-scenarios-drafts-panel";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Scenarios",
  description: "Scenario workspace: draft what-if runs over the twin (preview).",
};

export default async function SupplyChainTwinScenariosPage() {
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Step 1</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Define scenario</p>
            <p className="mt-1 text-xs text-zinc-600">Create a draft below; name and JSON editing follow in later slices.</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 opacity-70">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Step 2</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Apply shocks</p>
            <p className="mt-1 text-xs text-zinc-600">Demand, lead time, capacity edits (stub).</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 opacity-70">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Step 3</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Review deltas</p>
            <p className="mt-1 text-xs text-zinc-600">KPI diff vs baseline (stub).</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin scenarios</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Scenario workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Drafts are tenant-scoped rows from the twin API. Open links target the detail route planned in Slice 40 (404 until that
          page exists).
        </p>
        <p className="mt-4">
          <Link
            href="/supply-chain-twin/scenarios/compare"
            className="text-sm font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
          >
            Compare drafts (preview shell)
          </Link>
        </p>
      </section>

      <TwinScenariosDraftsPanel />
    </main>
  );
}
