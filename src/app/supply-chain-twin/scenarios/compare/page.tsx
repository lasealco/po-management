import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Compare scenarios",
  description: "Side-by-side scenario draft comparison shell (preview).",
};

export default async function SupplyChainTwinScenariosComparePage() {
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

      <div className="mb-6">
        <Link
          href="/supply-chain-twin/scenarios"
          className="text-sm font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
        >
          ← Back to scenario drafts
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Compare scenario drafts</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          This route is a static shell for a read-only, side-by-side view of two tenant drafts. Slice 44 will load rows
          via query <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> (snapshot ids) through the existing
          scenario detail API — no solver or KPI engine here.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">What ships next</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-700">
          <li>Dual panes with JSON preview and a simple structural diff stub (same/different root keys).</li>
          <li>User-safe errors when ids are missing or not in your tenant (reuse twin API patterns).</li>
          <li>Entry only from the scenarios workspace (no new top-level nav item).</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Placeholder layout</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Two empty panels will appear here after Slice 44 wires data. For now, create or pick drafts from the list and
          return with bookmarked ids in the URL.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="min-h-[140px] rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 text-center text-sm text-zinc-500">
            Left draft (coming in Slice 44)
          </div>
          <div className="min-h-[140px] rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 text-center text-sm text-zinc-500">
            Right draft (coming in Slice 44)
          </div>
        </div>
      </section>
    </main>
  );
}
