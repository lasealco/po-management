"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubStagingApplyTarget } from "@/lib/apihub/constants";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type Summary = {
  target: ApiHubStagingApplyTarget;
  dryRun: boolean;
  rows: {
    rowIndex: number;
    ok: boolean;
    entityType?: string;
    entityId?: string;
    applyOp?: string;
    error?: string;
  }[];
};

function summarizeApplySummary(summary: Summary) {
  const ok = summary.rows.filter((r) => r.ok).length;
  const failed = summary.rows.length - ok;
  const byType = new Map<string, number>();
  for (const r of summary.rows) {
    if (r.ok && r.entityType) {
      byType.set(r.entityType, (byType.get(r.entityType) ?? 0) + 1);
    }
  }
  return { ok, failed, byType };
}

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
  const [applyApiErrorBody, setApplyApiErrorBody] = useState<unknown | null>(null);
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
    setApplyApiErrorBody(null);
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
        setApplyApiErrorBody(data);
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
      {error ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
          {applyApiErrorBody != null ? (
            <ApiHubAdvancedJsonDisclosure
              value={applyApiErrorBody}
              label="Advanced — staging apply error body"
              description="Parsed JSON from POST …/staging-batches/[id]/apply when the response was not OK."
              maxHeightClass="max-h-48"
              dark={false}
            />
          ) : null}
        </div>
      ) : null}
      {lastSummary ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-800 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Last result</p>
            <p className="mt-2">
              <span className="text-zinc-500">Target:</span>{" "}
              <span className="font-semibold capitalize">{lastSummary.target.replace(/_/g, " ")}</span>
              {" · "}
              <span className="text-zinc-500">Mode:</span>{" "}
              <span className="font-semibold">{lastSummary.dryRun ? "dry-run" : "commit"}</span>
            </p>
            {(() => {
              const s = summarizeApplySummary(lastSummary);
              return (
                <ul className="mt-2 space-y-1 text-zinc-700">
                  <li>
                    <span className="text-zinc-500">Rows:</span>{" "}
                    <span className="tabular-nums font-semibold">{lastSummary.rows.length}</span> total ·{" "}
                    <span className="tabular-nums text-emerald-800">{s.ok}</span> ok ·{" "}
                    <span className="tabular-nums text-red-800">{s.failed}</span> failed
                  </li>
                  {s.byType.size > 0 ? (
                    <li>
                      <span className="text-zinc-500">By entity:</span>{" "}
                      {[...s.byType.entries()]
                        .map(([k, v]) => `${v}× ${k}`)
                        .join(", ")}
                    </li>
                  ) : null}
                </ul>
              );
            })()}
          </div>
          <ApiHubAdvancedJsonDisclosure
            value={lastSummary}
            description="Full apply response summary as returned by the API."
            maxHeightClass="max-h-48"
          />
        </div>
      ) : null}
    </div>
  );
}
