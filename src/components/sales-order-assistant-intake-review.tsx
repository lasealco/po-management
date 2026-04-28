"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ReviewStatus = "PENDING" | "APPROVED" | "NEEDS_CHANGES" | "REJECTED";

type IntakeLine = {
  id: string;
  productId: string | null;
  productLabel: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  currency: string;
  source: string | null;
};

export function SalesOrderAssistantIntakeReview({
  salesOrderId,
  canEdit,
  initialStatus,
  initialNote,
  initialDraftReply,
  sourceText,
  lines,
}: {
  salesOrderId: string;
  canEdit: boolean;
  initialStatus: ReviewStatus;
  initialNote: string | null;
  initialDraftReply: string | null;
  sourceText: string | null;
  lines: IntakeLine[];
}) {
  const router = useRouter();
  const [draftReply, setDraftReply] = useState(initialDraftReply ?? "");
  const [reviewNote, setReviewNote] = useState(initialNote ?? "");
  const [editableLines, setEditableLines] = useState(lines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(nextStatus?: ReviewStatus) {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales-orders/${salesOrderId}/assistant-intake`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantDraftReply: draftReply,
        assistantReviewNote: reviewNote,
        ...(nextStatus ? { assistantReviewStatus: nextStatus } : {}),
        lines: editableLines.map((line) => ({
          id: line.id,
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          currency: line.currency,
        })),
      }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not save assistant intake review."));
      return;
    }
    router.refresh();
  }

  async function copyReply() {
    if (!draftReply.trim()) return;
    await navigator.clipboard.writeText(draftReply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-800">Review: {initialStatus}</span>
        {canEdit ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save edits"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("APPROVED")}
              className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 font-semibold text-white disabled:opacity-50"
            >
              Approve intake
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("NEEDS_CHANGES")}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-semibold text-amber-950 disabled:opacity-50"
            >
              Needs changes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save("REJECTED")}
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 font-semibold text-rose-900 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white">
        {editableLines.length === 0 ? (
          <p className="px-4 py-3 text-sm text-zinc-500">No structured sales-order lines yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Product / description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {editableLines.map((line, index) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <input
                      value={line.description}
                      onChange={(event) =>
                        setEditableLines((current) =>
                          current.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)),
                        )
                      }
                      disabled={!canEdit}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      {line.productLabel ?? "No product link"}
                      {line.source ? ` · ${line.source}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={line.quantity}
                      onChange={(event) =>
                        setEditableLines((current) =>
                          current.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)),
                        )
                      }
                      disabled={!canEdit}
                      className="w-24 rounded border border-zinc-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={line.unitPrice}
                      onChange={(event) =>
                        setEditableLines((current) =>
                          current.map((item, i) => (i === index ? { ...item, unitPrice: event.target.value } : item)),
                        )
                      }
                      disabled={!canEdit}
                      className="w-28 rounded border border-zinc-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {line.currency} {Number(line.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-950">Customer reply draft</p>
            <p className="mt-1 text-xs text-zinc-500">Edit and copy manually. The assistant never sends this.</p>
          </div>
          <button
            type="button"
            onClick={() => void copyReply()}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {copied ? "Copied" : "Copy reply"}
          </button>
        </div>
        <textarea
          value={draftReply}
          onChange={(event) => setDraftReply(event.target.value)}
          disabled={!canEdit}
          className="mt-3 min-h-40 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
        />
      </div>

      <label className="block text-sm font-medium text-zinc-700">
        Review note
        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          disabled={!canEdit}
          className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800"
          placeholder="Why did you approve, reject, or request changes?"
        />
      </label>

      {sourceText ? (
        <details className="rounded-xl border border-emerald-100 bg-white p-3 text-xs text-zinc-600">
          <summary className="cursor-pointer font-semibold text-zinc-800">Assistant source request</summary>
          <p className="mt-2 whitespace-pre-wrap">{sourceText}</p>
        </details>
      ) : null}
    </div>
  );
}
