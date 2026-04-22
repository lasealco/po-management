"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";

export type StagingRowView = {
  id: string;
  rowType: string;
  rawPayload: unknown;
  normalizedPayload: unknown;
  unresolvedFlags: unknown;
  approved: boolean;
  confidenceScore: string | null;
};

export function TariffImportStagingGridClient({
  batchId,
  rows,
  canEdit,
}: {
  batchId: string;
  rows: StagingRowView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleApproved(row: StagingRowView) {
    if (!canEdit) return;
    setPendingId(row.id);
    try {
      const res = await fetch(`/api/tariffs/import-batches/${batchId}/staging-rows/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !row.approved }),
      });
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => ({}));
        window.alert(apiClientErrorMessage(j, "Update failed"));
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pl-4 pr-2">Row type</th>
            <th className="py-2 pr-2">Staging row id</th>
            <th className="py-2 pr-2">Summary</th>
            <th className="py-2 pr-2">Approved</th>
            <th className="py-2 pr-4">Payload</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                No staging rows yet. Upload completes with parse status &quot;Uploaded&quot;; a future parser will
                populate this grid. You can load sample rows from the workflow panel to preview columns.
              </td>
            </tr>
          ) : null}
          {rows.map((r) => {
            const raw = r.rawPayload && typeof r.rawPayload === "object" && !Array.isArray(r.rawPayload) ? r.rawPayload as Record<string, unknown> : {};
            const summary =
              [raw.rawChargeName, raw.rawGeoOriginLabel, raw.rawGeoDestinationLabel]
                .filter(Boolean)
                .join(" · ") || "—";
            const expanded = openId === r.id;
            return (
              <tr key={r.id} className="border-b border-zinc-100 align-top">
                <td className="py-2 pl-4 pr-2 font-mono text-xs text-zinc-700">{r.rowType}</td>
                <td className="py-2 pr-2 align-top">
                  <RecordIdCopy id={r.id} copyButtonLabel="Copy staging row id" />
                </td>
                <td className="max-w-xs py-2 pr-2 text-xs text-zinc-800">{summary}</td>
                <td className="py-2 pr-2">
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={pendingId === r.id}
                      onClick={() => void toggleApproved(r)}
                      className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                    >
                      {r.approved ? "Approved" : "Mark approved"}
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-600">{r.approved ? "Yes" : "No"}</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    onClick={() => setOpenId(expanded ? null : r.id)}
                  >
                    {expanded ? "Hide JSON" : "View JSON"}
                  </button>
                  {expanded ? (
                    <div className="mt-2 grid gap-2 text-xs">
                      <div>
                        <span className="font-semibold text-zinc-500">rawPayload</span>
                        <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-zinc-900 p-2 text-[11px] text-zinc-100">
                          {JSON.stringify(r.rawPayload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-500">normalizedPayload</span>
                        <pre className="mt-1 max-h-36 overflow-auto rounded-lg bg-zinc-800 p-2 text-[11px] text-zinc-100">
                          {JSON.stringify(r.normalizedPayload ?? null, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-semibold text-zinc-500">unresolvedFlags</span>
                        <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-zinc-800 p-2 text-[11px] text-zinc-100">
                          {JSON.stringify(r.unresolvedFlags ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
