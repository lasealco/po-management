"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    lifecycleScore: number;
    leadershipSummary: string;
    productCount: number;
    passportGapCount: number;
    documentRiskCount: number;
    supplierComplianceGapCount: number;
    sustainabilityGapCount: number;
    lifecycleActionCount: number;
    catalogReadiness: { productCount: number; activeProductCount: number; catalogGapCount: number; guardrail: string; gaps: Array<{ sku: string | null; productCode: string | null; name: string; missing: string[] }> };
    passportEvidence: { evidenceRecordCount: number; passportGapCount: number; requiredEvidence: string[]; guardrail: string; gaps: Array<{ sku: string | null; productCode: string | null; name: string; missing: string[] }> };
    supplierCompliance: { supplierDocumentCount: number; documentRiskCount: number; overdueTaskCount: number; contractPacketRiskCount: number; supplierComplianceGapCount: number; guardrail: string };
    sustainabilityPassport: { sustainabilityPacketCount: number; weakPacketCount: number; sustainabilityGapCount: number; dangerousGoodsProductCount: number; temperatureControlledProductCount: number; guardrail: string };
    lifecycleRisk: { externalRiskCount: number; pendingActionCount: number; guardrail: string };
    releaseChecklist: { releaseReady: boolean; blockerCount: number; blockers: string[]; checklist: string[]; guardrail: string };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    lifecycleScore: number;
    productCount: number;
    passportGapCount: number;
    documentRiskCount: number;
    supplierComplianceGapCount: number;
    sustainabilityGapCount: number;
    lifecycleActionCount: number;
    catalogReadinessJson: unknown;
    passportEvidenceJson: unknown;
    supplierComplianceJson: unknown;
    sustainabilityPassportJson: unknown;
    lifecycleRiskJson: unknown;
    releaseChecklistJson: unknown;
    rollbackPlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key: string): T[] {
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function ProductLifecyclePassportClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/product-lifecycle-passport", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Product Lifecycle Passport."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    if (!canEdit) return;
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/product-lifecycle-passport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Product Lifecycle Passport."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 13, but packet creation and passport review actions require edit access.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 13</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Product Lifecycle & Compliance Passport</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Freeze product catalog readiness, passport evidence, supplier compliance, sustainability posture, lifecycle risk, and release gates before public claims or product lifecycle actions.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview lifecycle</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.lifecycleScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Collect product evidence", "Load catalog, product documents, supplier links, supplier vault documents, onboarding work, sustainability packets, compliance packets, risks, and queue evidence."],
            ["Step 2", "Freeze passport packet", "Persist catalog readiness, passport evidence, supplier compliance, sustainability passport, lifecycle risk, release checklist, response plan, and rollback evidence."],
            ["Step 3", "Approve before release", "Queue owner review before product activation, passport publication, supplier changes, certificates, ESG claims, recalls, or customer communication."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled={!canEdit || busy === "create_packet"} onClick={() => void post("create_packet", {}, "Product Lifecycle Passport packet created.")} className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          Create Sprint 13 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Products", data.signals.products],
          ["Supplier docs", data.signals.supplierDocuments],
          ["Supplier tasks", data.signals.supplierTasks],
          ["Sustainability", data.signals.sustainabilityPackets],
          ["Contracts", data.signals.contractCompliancePackets],
          ["Risk signals", data.signals.riskSignals],
          ["Queue", data.signals.actionQueueItems],
          ["Score", data.signals.previewLifecycleScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Passport Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Catalog readiness</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.catalogReadiness.activeProductCount}/{data.preview.catalogReadiness.productCount} active products, {data.preview.catalogReadiness.catalogGapCount} catalog gap(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Passport evidence</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.passportEvidence.evidenceRecordCount} evidence item(s), {data.preview.passportEvidence.passportGapCount} passport gap(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Release checklist</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.releaseChecklist.releaseReady ? "Ready for owner review" : `${data.preview.releaseChecklist.blockerCount} blocker(s) before release review`}.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Compliance and Risk</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Supplier compliance</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.supplierCompliance.supplierComplianceGapCount} gap(s), {data.preview.supplierCompliance.documentRiskCount} document risk(s), {data.preview.supplierCompliance.overdueTaskCount} overdue task(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Sustainability passport</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.sustainabilityPassport.sustainabilityGapCount} gap(s), {data.preview.sustainabilityPassport.dangerousGoodsProductCount} DG product(s), {data.preview.sustainabilityPassport.temperatureControlledProductCount} temperature-controlled product(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Lifecycle risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.lifecycleRisk.externalRiskCount} external risk(s), {data.preview.lifecycleRisk.pendingActionCount} pending action(s).</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const passportGaps = readArray<{ sku: string | null; productCode: string | null; name: string; missing: string[] }>(packet.passportEvidenceJson, "gaps");
            const blockers = readArray<string>(packet.releaseChecklistJson, "blockers");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{packet.status} · score {packet.lifecycleScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}</p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">{packet.productCount} product(s) · passport {packet.passportGapCount} · document {packet.documentRiskCount} · supplier {packet.supplierComplianceGapCount} · sustainability {packet.sustainabilityGapCount} · actions {packet.lifecycleActionCount}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "PASSPORT_REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_passport_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Product passport review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Product Lifecycle Passport packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Passport gaps</p><p className="mt-1">{passportGaps.slice(0, 2).map((item) => `${item.sku ?? item.productCode ?? item.name}: ${item.missing.join(", ")}`).join("; ") || "No gaps"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Release blockers</p><p className="mt-1">{blockers.slice(0, 2).join("; ") || "No blockers"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No product mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional product passport review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 13 packets yet. Create the first durable Product Lifecycle Passport packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
