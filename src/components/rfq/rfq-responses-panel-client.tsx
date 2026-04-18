"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ResponsePanelRow = {
  recipientId: string;
  displayName: string;
  responseId: string | null;
  status: string | null;
};

const REVIEW_OPTIONS = ["UNDER_REVIEW", "SHORTLISTED", "AWARDED", "REJECTED", "WITHDRAWN"] as const;

export function RfqResponsesPanelClient({
  requestId,
  canEdit,
  rows,
}: {
  requestId: string;
  canEdit: boolean;
  rows: ResponsePanelRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function ensureResponse(recipientId: string) {
    setPendingId(recipientId);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; response?: { id: string } };
      if (!res.ok) {
        window.alert(data.error ?? "Failed");
        return;
      }
      if (data.response?.id) {
        router.push(`/rfq/requests/${requestId}/responses/${data.response.id}/edit`);
      }
    } finally {
      setPendingId(null);
    }
  }

  async function review(responseId: string, status: string) {
    setPendingId(responseId);
    try {
      const res = await fetch(`/api/rfq/responses/${responseId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Review update failed");
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
            <th className="py-2 pl-4 pr-2">Recipient</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.recipientId} className="border-b border-zinc-100">
              <td className="py-2 pl-4 pr-2 font-medium text-zinc-900">{r.displayName}</td>
              <td className="py-2 pr-2 text-xs text-zinc-600">{r.responseId ? (r.status ?? "—") : "No quote"}</td>
              <td className="py-2 pr-4">
                {!r.responseId ? (
                  canEdit ? (
                    <button
                      type="button"
                      disabled={pendingId === r.recipientId}
                      onClick={() => void ensureResponse(r.recipientId)}
                      className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                    >
                      {pendingId === r.recipientId ? "…" : "Enter / edit quote"}
                    </button>
                  ) : (
                    "—"
                  )
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <Link
                      href={`/rfq/requests/${requestId}/responses/${r.responseId}/edit`}
                      className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline"
                    >
                      Open editor
                    </Link>
                    {canEdit &&
                    r.status &&
                    ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"].includes(r.status) ? (
                      <label className="flex items-center gap-1 text-xs text-zinc-600">
                        <span>Review:</span>
                        <select
                          className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs"
                          disabled={pendingId === r.responseId}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = "";
                            if (v) void review(r.responseId!, v);
                          }}
                        >
                          <option value="" disabled>
                            Set…
                          </option>
                          {REVIEW_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
