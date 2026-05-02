import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { TwinEntityActivityTeaser } from "@/components/supply-chain-twin/twin-entity-activity-teaser";
import { TwinEntityJsonPreview } from "@/components/supply-chain-twin/twin-entity-json-preview";
import { TwinEntityNeighborsPanel } from "@/components/supply-chain-twin/twin-entity-neighbors-panel";
import { TwinEventsExportAction } from "@/components/supply-chain-twin/twin-events-export-action";
import { TwinFallbackState } from "@/components/supply-chain-twin/twin-fallback-state";
import { getEntitySnapshotByIdForTenant } from "@/lib/supply-chain-twin/repo";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Explorer entity",
  description: "Read-only summary for a single twin entity snapshot (preview).",
};

export default async function SupplyChainTwinExplorerEntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const gate = await requireTwinApiAccess();
  if (!gate.ok) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message={gate.denied.error}
      />
    );
  }
  const { access } = gate;

  const { entityId } = await params;
  const snapshotId = entityId.trim();
  if (!snapshotId || snapshotId.length > 128) {
    notFound();
  }

  let snapshot: Awaited<ReturnType<typeof getEntitySnapshotByIdForTenant>>;
  try {
    snapshot = await getEntitySnapshotByIdForTenant(access.tenant.id, snapshotId);
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="mt-6">
          <TwinFallbackState
            tone="error"
            title="Unable to load this snapshot"
            description="A server error occurred while reading the Twin catalog. Try again later or return to explorer."
            actions={
              <Link
                href="/supply-chain-twin/explorer"
                className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
              >
                ← Back to explorer
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">

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
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Entity snapshot</h1>
          <TwinEventsExportAction />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Read-only materialized row for your workspace session.
        </p>

        <dl className="mt-6 grid gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Snapshot id</dt>
            <dd className="mt-1 break-all font-mono text-sm text-zinc-900">{snapshot.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kind</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-900">{snapshot.ref.kind}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entity key</dt>
            <dd className="mt-1 break-all font-mono text-sm text-zinc-900">{snapshot.ref.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-800">{snapshot.createdAt.toISOString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Updated</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-800">{snapshot.updatedAt.toISOString()}</dd>
          </div>
        </dl>
      </section>

      <TwinEntityActivityTeaser />
      <TwinEntityNeighborsPanel snapshotId={snapshot.id} />

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Payload (JSON)</h2>
        <p className="mt-1 text-xs text-zinc-500">Preview is truncated when the serialized document is large.</p>
        <div className="mt-4">
          <TwinEntityJsonPreview payload={snapshot.payload} />
        </div>
      </section>
    </main>
  );
}
