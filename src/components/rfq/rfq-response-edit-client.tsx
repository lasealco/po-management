"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

export type LineDraft = {
  lineType: string;
  label: string;
  amount: string;
  currency: string;
  unitBasis: string;
  isIncluded: boolean;
  notes: string;
  sortOrder: number;
};

export function RfqResponseEditClient({
  requestId,
  responseId,
  canEdit,
  initial,
}: {
  requestId: string;
  responseId: string;
  canEdit: boolean;
  initial: {
    status: string;
    currency: string;
    totalAllInAmount: string;
    validityFrom: string;
    validityTo: string;
    includedJson: string;
    excludedJson: string;
    freeTimeJson: string;
    lines: LineDraft[];
  };
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState(initial.currency);
  const [total, setTotal] = useState(initial.totalAllInAmount);
  const [validFrom, setValidFrom] = useState(initial.validityFrom);
  const [validTo, setValidTo] = useState(initial.validityTo);
  const [includedJson, setIncludedJson] = useState(initial.includedJson);
  const [excludedJson, setExcludedJson] = useState(initial.excludedJson);
  const [freeTimeJson, setFreeTimeJson] = useState(initial.freeTimeJson);
  const [lines, setLines] = useState<LineDraft[]>(initial.lines);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        lineType: "SURCHARGE",
        label: "",
        amount: "",
        currency: currency || "USD",
        unitBasis: "per container",
        isIncluded: true,
        notes: "",
        sortOrder: prev.length,
      },
    ]);
  }

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i).map((row, j) => ({ ...row, sortOrder: j })));
  }

  function parseJsonField(raw: string, label: string): unknown {
    const t = raw.trim();
    if (!t) return [];
    try {
      return JSON.parse(t) as unknown;
    } catch {
      throw new Error(`${label} must be valid JSON.`);
    }
  }

  async function save(): Promise<boolean> {
    setError(null);
    let included: unknown;
    let excluded: unknown;
    let freeTime: unknown;
    try {
      included = parseJsonField(includedJson, "Included charges");
      excluded = parseJsonField(excludedJson, "Excluded charges");
      freeTime = parseJsonField(freeTimeJson, "Free time");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return false;
    }

    const linePayload = lines
      .filter((l) => l.label.trim() && l.lineType.trim())
      .map((l, idx) => ({
        lineType: l.lineType.trim(),
        label: l.label.trim(),
        amount: l.amount.trim() === "" ? null : Number(l.amount),
        currency: (l.currency || currency || "USD").trim(),
        unitBasis: l.unitBasis.trim() || null,
        isIncluded: l.isIncluded,
        notes: l.notes.trim() || null,
        sortOrder: idx,
      }));

    for (const row of linePayload) {
      if (row.amount !== null && Number.isNaN(row.amount)) {
        setError("Line amounts must be numbers or empty.");
        return false;
      }
    }

    setPending(true);
    try {
      const res = await fetch(`/api/rfq/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          totalAllInAmount: total.trim() === "" ? null : Number(total),
          validityFrom: validFrom.trim() || null,
          validityTo: validTo.trim() || null,
          includedChargesJson: included,
          excludedChargesJson: excluded,
          freeTimeSummaryJson: freeTime,
          lines: linePayload,
        }),
      });
      const parsed: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(parsed, "Save failed."));
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    setError(null);
    const ok = await save();
    if (!ok) return;
    setPending(true);
    try {
      const res = await fetch(`/api/rfq/responses/${responseId}/submit`, { method: "POST" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiClientErrorMessage(data, "Submit failed."));
        return;
      }
      router.push(`/rfq/requests/${requestId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const readOnly = !canEdit || initial.status !== "DRAFT";

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <p className="text-xs text-zinc-500">
        Quote status: <span className="font-semibold text-zinc-800">{initial.status}</span>
        {readOnly ? " — only draft quotes are editable here." : null}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">All-in total</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={total}
            disabled={readOnly}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="4500"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Currency</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase disabled:bg-zinc-100"
            value={currency}
            disabled={readOnly}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="USD"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Validity from</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={validFrom}
            disabled={readOnly}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Validity to</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={validTo}
            disabled={readOnly}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Included charges (JSON array)</span>
        <textarea
          className="mt-1 min-h-[6rem] w-full rounded-lg border border-zinc-300 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 disabled:opacity-60"
          value={includedJson}
          disabled={readOnly}
          onChange={(e) => setIncludedJson(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Excluded charges (JSON array)</span>
        <textarea
          className="mt-1 min-h-[6rem] w-full rounded-lg border border-zinc-300 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 disabled:opacity-60"
          value={excludedJson}
          disabled={readOnly}
          onChange={(e) => setExcludedJson(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Free time summary (JSON object)</span>
        <p className="mt-0.5 text-xs text-zinc-500">
          e.g. {`{ "demurrageDays": 7, "detentionDays": 10, "notes": "combined at POD" }`}
        </p>
        <textarea
          className="mt-1 min-h-[5rem] w-full rounded-lg border border-zinc-300 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 disabled:opacity-60"
          value={freeTimeJson}
          disabled={readOnly}
          onChange={(e) => setFreeTimeJson(e.target.value)}
        />
      </label>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-800">Line breakdown</p>
          {!readOnly ? (
            <button
              type="button"
              onClick={addLine}
              className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline"
            >
              Add line
            </button>
          ) : null}
        </div>
        <div className="mt-2 space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                  placeholder="lineType"
                  value={line.lineType}
                  disabled={readOnly}
                  onChange={(e) => updateLine(i, { lineType: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-300 px-2 py-1 text-xs sm:col-span-2"
                  placeholder="Label"
                  value={line.label}
                  disabled={readOnly}
                  onChange={(e) => updateLine(i, { label: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                  placeholder="Amount"
                  value={line.amount}
                  disabled={readOnly}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                  placeholder="Unit"
                  value={line.unitBasis}
                  disabled={readOnly}
                  onChange={(e) => updateLine(i, { unitBasis: e.target.value })}
                />
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={line.isIncluded}
                    disabled={readOnly}
                    onChange={(e) => updateLine(i, { isIncluded: e.target.checked })}
                  />
                  Included in all-in
                </label>
                {!readOnly ? (
                  <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => removeLine(i)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void submit()}
              className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Save &amp; submit
            </button>
          </>
        ) : null}
        <Link
          href={`/rfq/requests/${requestId}`}
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to RFQ
        </Link>
      </div>
    </div>
  );
}
