"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubStagingApplyTarget } from "@/lib/apihub/constants";

type Summary = {
  target: ApiHubStagingApplyTarget;
  dryRun: boolean;
  rows: { rowIndex: number; ok: boolean; entityType?: string; entityId?: string; error?: string }[];
};

type Props = {
  batchId: string;
  canApplySalesOrder: boolean;
  canApplyPurchaseOrder: boolean;
  canApplyCtAudit: boolean;
};

export function StagingBatchApplyActions({
  batchId,
  canApplySalesOrder,
  canApplyPurchaseOrder,
  canApplyCtAudit,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<Summary | null>(null);

  const anyApply = canApplySalesOrder || canApplyPurchaseOrder || canApplyCtAudit;
  if (!anyApply) {
    return (
      <p className="mt-2 text-xs text-zinc-500">
        Needs Integration hub edit plus{" "}
        <span className="font-medium text-zinc-700">org.orders</span> (SO/PO) or{" "}
        <span className="font-medium text-zinc-700">org.controltower</span> (audit) to apply downstream.
      </p>
    );
  }

  async function run(target: ApiHubStagingApplyTarget, dryRun: boolean) {
    setError(null);
    setLastSummary(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/staging-batches/${encodeURIComponent(batchId)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Apply failed."));
        return;
      }
      const summary = (data as { summary: Summary }).summary;
      setLastSummary(summary ?? null);
      if (!dryRun) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

  return (
    <div className="mt-2 border-t border-zinc-100 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Downstream apply</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {canApplySalesOrder ? (
          <>
            <button type="button" className={btn} disabled={busy} onClick={() => void run("sales_order", true)}>
              Dry-run → SO
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void run("sales_order", false)}>
              Apply → SO
            </button>
          </>
        ) : null}
        {canApplyPurchaseOrder ? (
          <>
            <button type="button" className={btn} disabled={busy} onClick={() => void run("purchase_order", true)}>
              Dry-run → PO
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void run("purchase_order", false)}>
              Apply → PO
            </button>
          </>
        ) : null}
        {canApplyCtAudit ? (
          <>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => void run("control_tower_audit", true)}
            >
              Dry-run → CT audit
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => void run("control_tower_audit", false)}
            >
              Apply → CT audit
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {lastSummary ? (
        <pre className="mt-2 max-h-32 overflow-auto rounded border border-zinc-100 bg-zinc-50 p-2 font-mono text-[10px] text-zinc-800">
          {JSON.stringify(lastSummary, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
