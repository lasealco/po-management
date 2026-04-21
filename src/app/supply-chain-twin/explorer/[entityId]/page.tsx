import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Explorer entity",
  description: "Read-only shell for a single twin entity snapshot (preview).",
};

export default async function SupplyChainTwinExplorerEntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
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

  const { entityId } = await params;
  const safeId = entityId.trim().slice(0, 128) || "(missing id)";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <div className="mb-6">
        <Link
          href="/supply-chain-twin/explorer"
          className="text-sm font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
        >
          ← Back to explorer
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin explorer</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Entity snapshot</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Deep-link shell for one materialized row. The path segment is the snapshot primary key (
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">{safeId}</code>
          ). Summary and JSON preview will load here in a later slice.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Placeholder</p>
        <p className="mt-2">
          No catalog fetch runs on this page yet. After seeding, open a row from the explorer table once deep links
          are wired, or paste a snapshot <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">id</code> from your
          database to confirm routing.
        </p>
      </section>
    </main>
  );
}
