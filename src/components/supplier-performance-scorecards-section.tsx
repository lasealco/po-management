"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierPerformanceScorecardRow = {
  id: string;
  periodKey: string;
  onTimeDeliveryPct: string | null;
  qualityRating: number | null;
  notes: string | null;
  recordedAt: string;
};

export function SupplierPerformanceScorecardsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierPerformanceScorecardRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState("");
  const [onTime, setOnTime] = useState("");
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");

  async function addScorecard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pk = periodKey.trim();
    if (!pk) {
      setError("Period key is required (e.g. 2026-Q1).");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = { periodKey: pk };
    if (onTime.trim() !== "") body.onTimeDeliveryPct = Number.parseFloat(onTime);
    if (quality.trim() !== "") {
      const q = Number.parseInt(quality, 10);
      if (!Number.isNaN(q)) body.qualityRating = q;
    }
    if (notes.trim()) body.notes = notes.trim();
    const res = await fetch(`/api/suppliers/${supplierId}/performance-scorecards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as {
      error?: string;
      scorecard?: SupplierPerformanceScorecardRow;
    };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add scorecard.");
      return;
    }
    if (payload.scorecard) setRows((prev) => [payload.scorecard!, ...prev]);
    setPeriodKey("");
    setOnTime("");
    setQuality("");
    setNotes("");
    setBusy(false);
    router.refresh();
  }

  async function patchScorecard(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/performance-scorecards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as {
      error?: string;
      scorecard?: SupplierPerformanceScorecardRow;
    };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.scorecard) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.scorecard! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  async function deleteScorecard(id: string) {
    if (!globalThis.confirm("Remove this performance scorecard? This cannot be undone.")) return;
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/performance-scorecards/${id}`, {
      method: "DELETE",
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Could not remove scorecard.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setBusyId(null);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Performance scorecards</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Record delivery and quality metrics by period (one row per supplier per period key). Tie to
        your internal reporting calendar (e.g. fiscal quarters).
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No scorecards yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium text-zinc-900">{r.periodKey}</p>
                  <p className="text-[11px] text-zinc-500">
                    Recorded {new Date(r.recordedAt).toLocaleString()}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <label className="text-xs text-zinc-600">
                      On-time %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        defaultValue={r.onTimeDeliveryPct ?? ""}
                        disabled={busyId === r.id}
                        className={`${f} w-24`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === (r.onTimeDeliveryPct ?? "")) return;
                          if (v === "") {
                            void patchScorecard(r.id, { onTimeDeliveryPct: null });
                            return;
                          }
                          const next = Number.parseFloat(v);
                          if (Number.isNaN(next)) return;
                          void patchScorecard(r.id, { onTimeDeliveryPct: next });
                        }}
                      />
                    </label>
                    <label className="text-xs text-zinc-600">
                      Quality 1–5
                      <input
                        type="number"
                        min={1}
                        max={5}
                        defaultValue={r.qualityRating ?? ""}
                        disabled={busyId === r.id}
                        className={`${f} w-20`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === (r.qualityRating != null ? String(r.qualityRating) : "")) return;
                          if (v === "") {
                            void patchScorecard(r.id, { qualityRating: null });
                            return;
                          }
                          const next = Number.parseInt(v, 10);
                          if (Number.isNaN(next)) return;
                          void patchScorecard(r.id, { qualityRating: next });
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">
                    On-time {r.onTimeDeliveryPct ?? "—"}% · Quality {r.qualityRating ?? "—"}
                  </p>
                )}
              </div>
              {canEdit ? (
                <label className="mt-2 block text-xs text-zinc-600">
                  Notes
                  <textarea
                    key={`${r.id}-notes-${r.notes ?? ""}`}
                    defaultValue={r.notes ?? ""}
                    disabled={busyId === r.id}
                    rows={2}
                    className={f}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      const prev = (r.notes ?? "").trim();
                      if (v === prev) return;
                      void patchScorecard(r.id, { notes: v || null });
                    }}
                  />
                </label>
              ) : r.notes ? (
                <p className="mt-2 text-xs text-zinc-600">{r.notes}</p>
              ) : null}
              {canEdit ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void deleteScorecard(r.id)}
                    className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-900 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Remove scorecard
                  </button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addScorecard} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Add scorecard</p>
          <label className="flex flex-col text-sm">
            <span>Period key *</span>
            <input
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className={f}
              placeholder="2026-Q1"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>On-time delivery %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={onTime}
              onChange={(e) => setOnTime(e.target.value)}
              className={f}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>Quality rating (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className={f}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={f} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add scorecard"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
