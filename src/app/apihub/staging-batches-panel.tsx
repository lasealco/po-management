import type { ApiHubStagingBatchListItemDto } from "@/lib/apihub/staging-batch-dto";

import { StagingBatchApplyActions } from "./staging-batch-apply-actions";
import { StagingBatchDiscardButton } from "./staging-batch-discard-button";

type Props = {
  initialBatches: ApiHubStagingBatchListItemDto[];
  canView: boolean;
  canEdit: boolean;
  canApplySalesOrder: boolean;
  canApplyPurchaseOrder: boolean;
  canApplyCtAudit: boolean;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function StagingBatchesPanel({
  initialBatches,
  canView,
  canEdit,
  canApplySalesOrder,
  canApplyPurchaseOrder,
  canApplyCtAudit,
}: Props) {
  if (!canView) {
    return (
      <section id="staging-batches" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Staging batches</h2>
        <p className="mt-2 text-sm text-zinc-600">You need Integration hub access (org.apihub → view).</p>
      </section>
    );
  }

  return (
    <section id="staging-batches" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Persistence</p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">Staging batches</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        Materialized rows from a succeeded mapping analysis job (capped server-side). Apply open batches to{" "}
        <span className="font-medium text-zinc-800">sales orders</span>,{" "}
        <span className="font-medium text-zinc-800">purchase orders</span>, or{" "}
        <span className="font-medium text-zinc-800">Control Tower audit</span> when mapped fields match the contract
        (see API docs). Use{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-[11px]">POST …/staging-batches/[id]/apply</code>.
      </p>

      {initialBatches.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No staging batches yet. Run analysis, then use “Materialize staging” on a succeeded job.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source job</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 min-w-[14rem]">Apply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
              {initialBatches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-600">{b.id.slice(0, 12)}…</span>
                    {b.title ? <div className="mt-0.5 text-xs text-zinc-500">{b.title}</div> : null}
                  </td>
                  <td className="px-4 py-3">{b.rowCount}</td>
                  <td className="px-4 py-3">{b.status}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                    {b.sourceMappingAnalysisJobId ? `${b.sourceMappingAnalysisJobId.slice(0, 12)}…` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{formatWhen(b.createdAt)}</td>
                  <td className="px-4 py-3 align-top text-xs">
                    {b.status === "open" && !b.appliedAt ? (
                      <>
                        <StagingBatchApplyActions
                          batchId={b.id}
                          canApplySalesOrder={canApplySalesOrder}
                          canApplyPurchaseOrder={canApplyPurchaseOrder}
                          canApplyCtAudit={canApplyCtAudit}
                        />
                        <StagingBatchDiscardButton batchId={b.id} canDiscard={canEdit} />
                      </>
                    ) : b.appliedAt ? (
                      <span className="text-zinc-500">Applied {formatWhen(b.appliedAt)}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
