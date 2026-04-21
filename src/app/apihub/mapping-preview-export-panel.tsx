"use client";

import { useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";

type Props = {
  canUse: boolean;
};

const SAMPLE_RECORDS = `[
  { "shipment": { "id": " sh-1 " }, "totals": { "amount": "42.5" } }
]`;

const SAMPLE_RULES = `[
  { "sourcePath": "shipment.id", "targetField": "shipmentId", "transform": "trim", "required": true },
  { "sourcePath": "totals.amount", "targetField": "amount", "transform": "number" }
]`;

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = /filename="([^"]+)"/.exec(header);
  return m?.[1] ?? null;
}

export function MappingPreviewExportPanel({ canUse }: Props) {
  const [jobId, setJobId] = useState("");
  const [recordsJson, setRecordsJson] = useState(SAMPLE_RECORDS);
  const [rulesJson, setRulesJson] = useState(SAMPLE_RULES);
  const [sampleSize, setSampleSize] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("csv");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setError(null);
    const id = jobId.trim();
    if (!id) {
      setError("Ingestion job id is required (same id used in mapping preview URLs).");
      return;
    }
    let records: unknown;
    let rules: unknown;
    try {
      records = JSON.parse(recordsJson.trim());
    } catch {
      setError("Records must be valid JSON.");
      return;
    }
    try {
      rules = JSON.parse(rulesJson.trim());
    } catch {
      setError("Rules must be valid JSON.");
      return;
    }
    const body: Record<string, unknown> = { records, rules, format };
    if (sampleSize.trim().length > 0) {
      const n = Number(sampleSize.trim());
      if (!Number.isFinite(n)) {
        setError("sampleSize must be a number when provided.");
        return;
      }
      body.sampleSize = n;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/ingestion-jobs/${encodeURIComponent(id)}/mapping-preview/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(readApiHubErrorMessageFromJsonBody(data, "Export failed."));
        return;
      }
      const blob = await res.blob();
      const fallback = `mapping-preview-issues.${format === "json" ? "json" : "csv"}`;
      const name = parseFilenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallback;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="mapping-preview-export" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operations</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-900">Mapping preview issue export</h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        Download mapping preview issues as JSON (full payload) or CSV (one row per issue) for tickets and reviews.
        Uses the same validation as{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-xs">POST …/mapping-preview</code>.
      </p>

      {!canUse ? (
        <p className="mt-4 text-sm text-zinc-600">
          Choose a demo user in{" "}
          <a href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Settings → Demo session
          </a>{" "}
          to call the export API from this page.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">Ingestion job id</span>
            <input
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="run id (cuid)"
              className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs shadow-sm"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "json" | "csv")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="csv">CSV (issues only)</option>
              <option value="json">JSON (full report)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-zinc-800">Records (JSON)</span>
            <textarea
              value={recordsJson}
              onChange={(e) => setRecordsJson(e.target.value)}
              rows={6}
              spellCheck={false}
              className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs shadow-sm"
            />
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-zinc-800">Rules (JSON)</span>
            <textarea
              value={rulesJson}
              onChange={(e) => setRulesJson(e.target.value)}
              rows={6}
              spellCheck={false}
              className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs shadow-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">sampleSize (optional)</span>
            <input
              value={sampleSize}
              onChange={(e) => setSampleSize(e.target.value)}
              placeholder="omit for all records"
              className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs shadow-sm"
              autoComplete="off"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60 lg:w-auto"
            >
              {busy ? "Downloading…" : "Download report"}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
