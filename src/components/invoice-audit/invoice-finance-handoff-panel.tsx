"use client";

import { useEffect, useState } from "react";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";

type HandoffSnapshot = {
  intake: {
    id: string;
    status: string;
    vendorLabel: string | null;
    externalInvoiceNo: string | null;
    currency: string;
    rollupOutcome: string;
    reviewDecision: string;
    approvedForAccounting: boolean;
    financeHandoffStatus: string;
    financeHandoffSummary: string | null;
    disputeDraft: string | null;
    accountingPacketJson: unknown;
  };
  snapshot: {
    id: string;
    sourceType: string;
    sourceRecordId: string;
    sourceSummary: string | null;
    totalEstimatedCost: string;
    currency: string;
    frozenAt: string;
  };
  lines: Array<{
    lineNo: number | null;
    description: string;
    currency: string;
    amount: string;
    outcome: string;
    expectedAmount: string | null;
    amountVariance: string | null;
    explanation: string;
  }>;
  generated: {
    financeHandoffSummary: string;
    disputeDraft: string;
    accountingPacketJson: unknown;
  };
};

export function InvoiceFinanceHandoffPanel({ intakeId, canEdit }: { intakeId: string; canEdit: boolean }) {
  const [snapshot, setSnapshot] = useState<HandoffSnapshot | null>(null);
  const [summary, setSummary] = useState("");
  const [disputeDraft, setDisputeDraft] = useState("");
  const [packetText, setPacketText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/invoice-audit/intakes/${intakeId}/finance-handoff`);
    const parsed: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatInvoiceAuditApiError(parsed as Parameters<typeof formatInvoiceAuditApiError>[0], res.status));
      return;
    }
    const payload = parsed as HandoffSnapshot;
    setSnapshot(payload);
    setSummary(payload.intake.financeHandoffSummary ?? payload.generated.financeHandoffSummary);
    setDisputeDraft(payload.intake.disputeDraft ?? payload.generated.disputeDraft);
    setPacketText(JSON.stringify(payload.intake.accountingPacketJson ?? payload.generated.accountingPacketJson, null, 2));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intake id owns this panel
  }, [intakeId]);

  function parsedPacket() {
    try {
      const parsed = JSON.parse(packetText);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  async function save(status?: "READY_FOR_FINANCE" | "ACCOUNTING_READY") {
    if (!canEdit) return;
    const packet = parsedPacket();
    if (!packet) {
      setError("Accounting packet must be valid JSON object.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/invoice-audit/intakes/${intakeId}/finance-handoff`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financeHandoffSummary: summary,
        disputeDraft,
        accountingPacketJson: packet,
        ...(status ? { financeHandoffStatus: status } : {}),
      }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(formatInvoiceAuditApiError(parsed as Parameters<typeof formatInvoiceAuditApiError>[0], res.status));
      return;
    }
    setNotice(status ? `Finance handoff saved as ${status}.` : "Finance handoff saved.");
    await load();
  }

  async function queueAction(action: "queue_dispute" | "queue_accounting_packet") {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const text = action === "queue_dispute" ? disputeDraft : packetText;
    const res = await fetch(`/api/invoice-audit/intakes/${intakeId}/finance-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, text }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(formatInvoiceAuditApiError(parsed as Parameters<typeof formatInvoiceAuditApiError>[0], res.status));
      return;
    }
    setNotice(action === "queue_dispute" ? "Dispute note queued." : "Accounting packet queued.");
    await load();
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">AMP5 Finance Handoff</p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900">Pricing, dispute, and accounting packet</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Builds a copy-ready finance packet from the frozen pricing snapshot and invoice audit result. Nothing is sent or posted automatically.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-900">
          {snapshot?.intake.financeHandoffStatus ?? "Loading"}
        </span>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}

      {!snapshot ? (
        <p className="mt-4 text-sm text-zinc-600">Loading finance handoff packet...</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Rollup</p>
              <p className="font-semibold text-zinc-950">{snapshot.intake.rollupOutcome}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Review</p>
              <p className="font-semibold text-zinc-950">{snapshot.intake.reviewDecision}</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Frozen snapshot</p>
              <p className="font-semibold text-zinc-950">
                {snapshot.snapshot.totalEstimatedCost} {snapshot.snapshot.currency}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Attention lines</p>
              <p className="font-semibold text-zinc-950">{snapshot.lines.filter((line) => line.outcome !== "GREEN").length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-700">
              Finance handoff summary
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Vendor dispute draft
              <textarea
                value={disputeDraft}
                onChange={(event) => setDisputeDraft(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-zinc-700">
            Accounting packet JSON
            <textarea
              value={packetText}
              onChange={(event) => setPacketText(event.target.value)}
              disabled={!canEdit}
              className="mt-1 min-h-56 w-full rounded-xl border border-zinc-300 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
            />
          </label>

          <div className="rounded-xl border border-indigo-100 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-950">Line evidence</p>
            <div className="mt-2 max-h-52 space-y-2 overflow-auto text-xs text-zinc-700">
              {snapshot.lines.map((line) => (
                <div key={`${line.lineNo}-${line.description}`} className="rounded border border-zinc-100 p-2">
                  <p className="font-semibold">
                    Line {line.lineNo ?? "?"} · {line.outcome} · {line.amount} {line.currency}
                  </p>
                  <p>{line.description}</p>
                  <p className="text-zinc-500">
                    Expected {line.expectedAmount ?? "n/a"} · variance {line.amountVariance ?? "n/a"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
              >
                Save packet
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("READY_FOR_FINANCE")}
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Mark ready for finance
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void queueAction("queue_dispute")}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
              >
                Queue dispute note
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void queueAction("queue_accounting_packet")}
                className="rounded-xl border border-indigo-300 bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-950 disabled:opacity-50"
              >
                Queue accounting packet
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
