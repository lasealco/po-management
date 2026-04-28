"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    supplierDocuments: number;
    tariffContracts: number;
    rfqCommitments: number;
    previewComplianceScore: number;
    previewRiskItems: number;
  };
  preview: {
    complianceScore: number;
    obligationCount: number;
    expiringDocumentCount: number;
    renewalRiskCount: number;
    complianceGapCount: number;
    actionPlan: { steps?: Array<{ step: string; owner: string; action: string }> };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    complianceScore: number;
    obligationCount: number;
    expiringDocumentCount: number;
    renewalRiskCount: number;
    complianceGapCount: number;
    obligationJson: unknown;
    renewalRiskJson: unknown;
    documentRiskJson: unknown;
    complianceGapJson: unknown;
    actionPlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function ContractComplianceClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/contract-compliance", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load contract compliance."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/contract-compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update contract compliance."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP23</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Contract Compliance</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Turn supplier documents, tariff contracts, RFQ commitments, renewal windows, and compliance gaps into a
          governed contract packet. The assistant queues review work and never changes source contract records by itself.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Collect evidence", "Supplier documents, tariffs, RFQs, validity windows, and response evidence."],
            ["Step 2", "Extract obligations", "Renewals, document expiry, rate/charge/free-time gaps, and RFQ commitments."],
            ["Step 3", "Approve compliance", "Queue obligation and renewal work before source-system changes."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Contract compliance packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create compliance packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Supplier docs", data.signals.supplierDocuments],
          ["Tariff contracts", data.signals.tariffContracts],
          ["RFQ commitments", data.signals.rfqCommitments],
          ["Risk items", data.signals.previewRiskItems],
          ["Compliance score", data.signals.previewComplianceScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Live Compliance Preview</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Score {data.preview.complianceScore}/100 · obligations {data.preview.obligationCount} · documents {data.preview.expiringDocumentCount} · renewals {data.preview.renewalRiskCount} · gaps {data.preview.complianceGapCount}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(data.preview.actionPlan.steps ?? []).map((step) => (
            <div key={step.step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">{step.step}</p>
              <p className="mt-1 text-sm text-zinc-600">{step.owner}: {step.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Compliance Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const obligations = readArray<{ party: string; obligation: string }>(packet.obligationJson);
            const documentRisks = readArray<{ title: string; severity: string; requiredAction: string }>(packet.documentRiskJson);
            const renewalRisks = readArray<{ title: string; severity: string; risk: string }>(packet.renewalRiskJson);
            const gaps = readArray<{ title: string; severity: string; gap: string }>(packet.complianceGapJson);
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.complianceScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Obligations {packet.obligationCount} · documents {packet.expiringDocumentCount} · renewals {packet.renewalRiskCount} · gaps {packet.complianceGapCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">Updated {new Date(packet.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === packet.id || packet.status === "REVIEW_QUEUED"}
                    onClick={() => void post("queue_compliance_review", { packetId: packet.id, approvalNote: approvalNotes[packet.id] ?? "" }, "Contract compliance review queued.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Queue review
                  </button>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Obligations</p>
                    <p className="mt-1">{obligations.slice(0, 2).map((item) => `${item.party}: ${item.obligation}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Documents</p>
                    <p className="mt-1">{documentRisks.slice(0, 2).map((item) => `${item.severity} ${item.title}`).join(", ") || "No risks"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Renewals</p>
                    <p className="mt-1">{renewalRisks.slice(0, 2).map((item) => `${item.severity} ${item.title}`).join(", ") || "No risks"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Gaps</p>
                    <p className="mt-1">{gaps.slice(0, 2).map((item) => `${item.severity} ${item.gap}`).join("; ") || "No gaps"}</p>
                  </div>
                </div>
                <textarea
                  value={approvalNotes[packet.id] ?? ""}
                  onChange={(event) => setApprovalNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional compliance approval note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No contract compliance packets yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
