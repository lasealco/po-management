"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  TARIFF_IMPORT_PARSE_STATUSES,
  TARIFF_IMPORT_REVIEW_STATUSES,
  parseStatusLabel,
  reviewStatusLabel,
} from "@/lib/tariff/import-batch-statuses";

export function TariffImportBatchWorkflowClient({
  batchId,
  initialParseStatus,
  initialReviewStatus,
  canEdit,
}: {
  batchId: string;
  initialParseStatus: string;
  initialReviewStatus: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [parseStatus, setParseStatus] = useState(initialParseStatus);
  const [reviewStatus, setReviewStatus] = useState(initialReviewStatus);
  const [replaceSample, setReplaceSample] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingSample, setPendingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatuses() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tariffs/import-batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parseStatus, reviewStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function loadSampleStaging() {
    setError(null);
    setPendingSample(true);
    try {
      const res = await fetch(`/api/tariffs/import-batches/${batchId}/sample-staging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: replaceSample }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; batch?: { parseStatus: string; reviewStatus: string } };
      if (!res.ok) {
        setError(data.error ?? "Could not add sample rows.");
        return;
      }
      if (data.batch) {
        setParseStatus(data.batch.parseStatus);
        setReviewStatus(data.batch.reviewStatus);
      }
      router.refresh();
    } finally {
      setPendingSample(false);
    }
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <p className="text-sm font-medium text-zinc-800">Workflow (manual until parser ships)</p>
      <p className="mt-1 text-xs text-zinc-600">
        Status fields are persisted. Use sample rows only to preview the staging grid — they are not produced by OCR
        or Excel parsing.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-medium text-zinc-600">Parse status</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            value={parseStatus}
            onChange={(e) => setParseStatus(e.target.value)}
          >
            {TARIFF_IMPORT_PARSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {parseStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium text-zinc-600">Review status</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value)}
          >
            {TARIFF_IMPORT_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {reviewStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveStatuses()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          Save statuses
        </button>
      </div>

      <div className="mt-6 border-t border-zinc-200 pt-4">
        <p className="text-xs font-medium text-zinc-600">Developer / QA preview</p>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
          <input type="checkbox" checked={replaceSample} onChange={(e) => setReplaceSample(e.target.checked)} />
          Replace existing staging rows before inserting samples
        </label>
        <button
          type="button"
          disabled={pendingSample}
          onClick={() => void loadSampleStaging()}
          className="mt-3 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          {pendingSample ? "Working…" : "Load sample staging rows"}
        </button>
      </div>
    </div>
  );
}
