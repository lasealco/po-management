"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: Record<string, number>;
  preview: {
    resilienceScore: number;
    leadershipSummary: string;
    collaborationHub: { partnerGapCount: number; partnerCount: number; supplierTaskCount: number; overdueSupplierTasks: Array<{ title: string; supplierName: string }>; partnerGaps: Array<{ title: string; readinessScore: number }>; guardrail: string };
    promiseReconciliation: { promiseRiskCount: number; weakCustomers: Array<{ title: string; serviceScore: number }>; openIncidents: Array<{ title: string; severity: string; customerImpact: string | null }>; guardrail: string };
    resiliencePlan: { climateRiskCount: number; sustainabilityScore: number; estimatedCo2eKg: number; resilienceEvents: Array<{ title: string; severity: string; confidence: number }>; sustainabilityRisks: Array<{ title: string; sustainabilityScore: number; missingDataCount: number }>; steps: string[]; guardrail: string };
    passportReadiness: { productCount: number; passportGapCount: number; gaps: Array<{ sku: string | null; name: string; missing: string[] }>; requiredEvidence: string[]; guardrail: string };
    workforceSafety: { workforceRiskCount: number; safetySignalCount: number; weakFrontline: Array<{ title: string; readinessScore: number; evidenceGapCount: number }>; safetyEvents: Array<{ title: string; severity: string }>; guardrail: string };
    externalRisk: { activeEventCount: number; topEvents: Array<{ title: string; severity: string; confidence: number }> };
    responsePlan: { status: string; owners: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    resilienceScore: number;
    partnerGapCount: number;
    promiseRiskCount: number;
    climateRiskCount: number;
    passportGapCount: number;
    workforceRiskCount: number;
    safetySignalCount: number;
    collaborationHubJson: unknown;
    promiseReconciliationJson: unknown;
    resiliencePlanJson: unknown;
    passportReadinessJson: unknown;
    workforceSafetyJson: unknown;
    responsePlanJson: unknown;
    rollbackPlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    approvedAt: string | null;
    approvalNote: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function CollaborationResilienceClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/collaboration-resilience", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load Collaboration & Resilience."));
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
    const res = await fetch("/api/assistant/collaboration-resilience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update Collaboration & Resilience."));
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
      {!canEdit ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You can view Sprint 5, but creating packets and resilience review actions require an edit grant in reports, SRM/suppliers, CRM, Control Tower, or WMS.</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 5</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Collaboration & Resilience</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Coordinate supplier/customer collaboration, promise reconciliation, climate and resource resilience, product passport evidence,
              frontline workforce readiness, and safety review in one approval-gated workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview resilience</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.resilienceScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.responsePlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Sense collaboration", "Gather partner, customer, incident, sustainability, frontline, product, event, and action evidence."],
            ["Step 2", "Create packet", "Persist collaboration, promise, resilience, passport, workforce, safety, and rollback evidence."],
            ["Step 3", "Review safely", "Queue or approve resilience work without changing promises, routes, suppliers, WMS, ESG claims, or passports."],
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
          disabled={!canEdit || busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Collaboration & Resilience packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 5 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-10">
        {[
          ["Partners", data.signals.partnerPackets],
          ["Customers", data.signals.customerBriefs],
          ["Incidents", data.signals.exceptionIncidents],
          ["ESG", data.signals.sustainabilityPackets],
          ["Frontline", data.signals.frontlinePackets],
          ["Tasks", data.signals.supplierTasks],
          ["Products", data.signals.products],
          ["Events", data.signals.externalEvents],
          ["Actions", data.signals.actionQueueItems],
          ["Score", data.signals.previewResilienceScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Resilience Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Collaboration hub</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.collaborationHub.partnerGapCount} partner gap(s), {data.preview.collaborationHub.supplierTaskCount} supplier task(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Promise reconciliation</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.promiseReconciliation.promiseRiskCount} promise risk(s), {data.preview.promiseReconciliation.openIncidents.length} incident(s) shown.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Resilience plan</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.resiliencePlan.climateRiskCount} climate/resource risk(s), {data.preview.resiliencePlan.estimatedCo2eKg} kg CO2e in packet evidence.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Passports, Workforce, and Safety</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Product passport readiness</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.passportReadiness.passportGapCount} gap(s) across {data.preview.passportReadiness.productCount} product(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Workforce and safety</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.workforceSafety.workforceRiskCount} workforce risk(s), {data.preview.workforceSafety.safetySignalCount} safety signal(s).</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">External risk</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.externalRisk.activeEventCount} active event(s) in collaboration and resilience view.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const partnerGaps = readArray<{ title: string; readinessScore: number }>(packet.collaborationHubJson, "partnerGaps");
            const incidents = readArray<{ title: string; severity: string }>(packet.promiseReconciliationJson, "openIncidents");
            const passportGaps = readArray<{ name: string; missing: string[] }>(packet.passportReadinessJson, "gaps");
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.resilienceScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Partners {packet.partnerGapCount} · promises {packet.promiseRiskCount} · resilience {packet.climateRiskCount} · passports {packet.passportGapCount} · workforce {packet.workforceRiskCount} · safety {packet.safetySignalCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "APPROVED"} onClick={() => void post("queue_resilience_review", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Resilience review queued.")} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Queue review</button>
                    <button type="button" disabled={!canEdit || busy === packet.id || packet.status === "APPROVED"} onClick={() => void post("approve_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Collaboration & Resilience packet approved.")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Approve packet</button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Partners</p><p className="mt-1">{partnerGaps.slice(0, 2).map((item) => `${item.title} ${item.readinessScore}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Promises</p><p className="mt-1">{incidents.slice(0, 2).map((item) => `${item.severity}: ${item.title}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Passports</p><p className="mt-1">{passportGaps.slice(0, 2).map((item) => `${item.name}: ${item.missing.join("/")}`).join("; ") || "None"}</p></div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700"><p className="font-semibold text-zinc-950">Rollback</p><p className="mt-1">{rollback[0] ?? "No source mutation."}</p></div>
                </div>
                <textarea value={notes[packet.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))} placeholder="Optional resilience review note" className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900" />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">No Sprint 5 packets yet. Create the first durable Collaboration & Resilience packet from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
