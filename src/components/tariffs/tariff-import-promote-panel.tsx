"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TARIFF_CONTRACTS_DIRECTORY_PATH, tariffContractVersionPath } from "@/lib/tariff/tariff-workbench-urls";

type HeaderOpt = { id: string; title: string; contractNumber: string | null; providerLabel: string };

export function TariffImportPromotePanel({
  batchId,
  contractHeaders,
  canEdit,
}: {
  batchId: string;
  contractHeaders: HeaderOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [headerId, setHeaderId] = useState(contractHeaders[0]?.id ?? "");
  const [pendingFixture, setPendingFixture] = useState(false);
  const [pendingPromote, setPendingPromote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  async function loadFixture() {
    setError(null);
    setPendingFixture(true);
    try {
      const res = await fetch(`/api/tariffs/import-batches/${batchId}/fixture-promotable-rows`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const fromServer = typeof data.error === "string" ? data.error.trim() : "";
        const detail = fromServer || "The fixture request was rejected.";
        setError(`${detail} (HTTP ${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setPendingFixture(false);
    }
  }

  async function promote() {
    setError(null);
    if (!headerId.trim()) {
      setError("Select a contract header.");
      return;
    }
    setPendingPromote(true);
    try {
      const res = await fetch(`/api/tariffs/import-batches/${batchId}/promote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractHeaderId: headerId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        versionId?: string;
        rateLineCount?: number;
        chargeLineCount?: number;
      };
      if (!res.ok) {
        const fromServer = typeof data.error === "string" ? data.error.trim() : "";
        const detail = fromServer || "Promote was rejected.";
        setError(`${detail} (HTTP ${res.status})`);
        return;
      }
      router.refresh();
      if (data.versionId) {
        router.push(tariffContractVersionPath(headerId, data.versionId));
      }
    } finally {
      setPendingPromote(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-emerald-950">Promote to contract version</p>
      <p className="mt-1 text-xs text-emerald-900">
        Set review status to <strong>READY_TO_APPLY</strong>, ensure approved{" "}
        <code className="rounded bg-white/80 px-1">RATE_LINE_CANDIDATE</code> /{" "}
        <code className="rounded bg-white/80 px-1">CHARGE_LINE_CANDIDATE</code> rows have{" "}
        <code className="rounded bg-white/80 px-1">normalizedPayload</code>, then pick a header and promote (creates
        a new <strong>draft</strong> version).
      </p>

      {error ? (
        <div
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="font-semibold text-red-900">Action blocked</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendingFixture}
          onClick={() => void loadFixture()}
          className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {pendingFixture ? "Adding…" : "Insert QA fixture rows"}
        </button>
        <span className="self-center text-xs text-emerald-800">(approved BASE_RATE + BAF using live geo ids)</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-emerald-900">Target contract</span>
          <select
            value={headerId}
            onChange={(e) => setHeaderId(e.target.value)}
            className="min-w-[220px] rounded-lg border border-emerald-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">Select header…</option>
            {contractHeaders.map((h) => (
              <option key={h.id} value={h.id}>
                {h.contractNumber ? `${h.contractNumber} · ` : ""}
                {h.title} ({h.providerLabel})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pendingPromote || !headerId}
          onClick={() => void promote()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {pendingPromote ? "Promoting…" : "Promote → new draft version"}
        </button>
        <Link href={TARIFF_CONTRACTS_DIRECTORY_PATH} className="text-xs font-medium text-emerald-800 underline">
          Manage contracts
        </Link>
      </div>
    </div>
  );
}
