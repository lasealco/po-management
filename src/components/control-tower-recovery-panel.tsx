"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useEffect, useState } from "react";

type RecoveryException = {
  id: string;
  type: string;
  severity: string;
  status: string;
  owner: { id: string; name: string } | null;
  rootCause: string | null;
  customerImpact: string | null;
  recoveryState: string;
  recoveryPlan: string | null;
  carrierDraft: string | null;
  customerDraft: string | null;
  playbookSteps: unknown;
};

type RecoverySnapshot = {
  shipment: {
    shipmentNo: string | null;
    trackingNo: string | null;
    carrier: string | null;
    customerName: string | null;
    originCode: string | null;
    destinationCode: string | null;
    latestEta: string | null;
    orderNumber: string | null;
  };
  exceptions: RecoveryException[];
  generated: {
    recoveryPlan: string;
    carrierDraft: string;
    customerDraft: string;
    playbookSteps: Array<{ id: string; label: string; done: boolean }>;
  };
};

type PlaybookStep = { id: string; label: string; done: boolean };

function normalizeSteps(value: unknown, fallback: PlaybookStep[]): PlaybookStep[] {
  if (!Array.isArray(value)) return fallback;
  const steps = value
    .map((raw) => {
      const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : "";
      const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : "";
      if (!id || !label) return null;
      return { id, label, done: Boolean(row.done) };
    })
    .filter((row): row is PlaybookStep => Boolean(row));
  return steps.length ? steps : fallback;
}

export function ControlTowerRecoveryPanel({ shipmentId, canEdit }: { shipmentId: string; canEdit: boolean }) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [selectedExceptionId, setSelectedExceptionId] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [customerImpact, setCustomerImpact] = useState("");
  const [recoveryState, setRecoveryState] = useState("TRIAGE");
  const [recoveryPlan, setRecoveryPlan] = useState("");
  const [carrierDraft, setCarrierDraft] = useState("");
  const [customerDraft, setCustomerDraft] = useState("");
  const [playbookSteps, setPlaybookSteps] = useState<PlaybookStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(`/api/control-tower/shipments/${shipmentId}/recovery`);
    const parsed: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not load recovery workspace."));
      return;
    }
    const payload = parsed as RecoverySnapshot;
    const primary = payload.exceptions.find((exception) => exception.status !== "RESOLVED") ?? payload.exceptions[0] ?? null;
    setSnapshot(payload);
    setSelectedExceptionId(primary?.id ?? "");
    setRootCause(primary?.rootCause ?? "");
    setCustomerImpact(primary?.customerImpact ?? "");
    setRecoveryState(primary?.recoveryState ?? "TRIAGE");
    setRecoveryPlan(primary?.recoveryPlan ?? payload.generated.recoveryPlan);
    setCarrierDraft(primary?.carrierDraft ?? payload.generated.carrierDraft);
    setCustomerDraft(primary?.customerDraft ?? payload.generated.customerDraft);
    setPlaybookSteps(normalizeSteps(primary?.playbookSteps, payload.generated.playbookSteps));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shipmentId owns the recovery workspace
  }, [shipmentId]);

  function chooseException(exceptionId: string) {
    const row = snapshot?.exceptions.find((exception) => exception.id === exceptionId) ?? null;
    setSelectedExceptionId(exceptionId);
    if (!row || !snapshot) return;
    setRootCause(row.rootCause ?? "");
    setCustomerImpact(row.customerImpact ?? "");
    setRecoveryState(row.recoveryState ?? "TRIAGE");
    setRecoveryPlan(row.recoveryPlan ?? snapshot.generated.recoveryPlan);
    setCarrierDraft(row.carrierDraft ?? snapshot.generated.carrierDraft);
    setCustomerDraft(row.customerDraft ?? snapshot.generated.customerDraft);
    setPlaybookSteps(normalizeSteps(row.playbookSteps, snapshot.generated.playbookSteps));
  }

  async function save(nextState?: string) {
    if (!canEdit || !selectedExceptionId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const state = nextState ?? recoveryState;
    const res = await fetch(`/api/control-tower/shipments/${shipmentId}/recovery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exceptionId: selectedExceptionId,
        rootCause,
        customerImpact,
        recoveryState: state,
        recoveryPlan,
        carrierDraft,
        customerDraft,
        playbookSteps,
      }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not save recovery plan."));
      return;
    }
    setRecoveryState(state);
    setNotice(`Recovery saved as ${state}.`);
    await load();
  }

  async function runAction(action: "queue_carrier_update" | "log_customer_update") {
    setBusy(true);
    setError(null);
    setNotice(null);
    const message = action === "queue_carrier_update" ? carrierDraft : customerDraft;
    const res = await fetch(`/api/control-tower/shipments/${shipmentId}/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, message }),
    });
    const parsed: unknown = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not complete recovery action."));
      return;
    }
    setNotice(action === "queue_carrier_update" ? "Carrier update queued." : "Customer update logged.");
    await load();
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">AMP3 Recovery</p>
          <h2 className="mt-1 text-base font-semibold text-zinc-950">Shipment recovery and communication</h2>
          <p className="mt-1 text-zinc-700">
            Triage exceptions, assign recovery state, and queue carrier/customer updates with audit evidence.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-900">{recoveryState}</span>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">{notice}</p> : null}

      {!snapshot ? (
        <p className="mt-4 text-zinc-600">Loading recovery workspace...</p>
      ) : snapshot.exceptions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-600">
          No exception exists yet. Create one on the Exceptions tab to start an AMP3 recovery workflow.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-orange-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Shipment</p>
              <p className="font-semibold text-zinc-950">{snapshot.shipment.shipmentNo ?? shipmentId}</p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Lane</p>
              <p className="font-semibold text-zinc-950">
                {snapshot.shipment.originCode ?? "-"} &rarr; {snapshot.shipment.destinationCode ?? "-"}
              </p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Carrier</p>
              <p className="font-semibold text-zinc-950">{snapshot.shipment.carrier ?? "Unknown"}</p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-white p-3">
              <p className="text-xs text-zinc-500">Customer</p>
              <p className="font-semibold text-zinc-950">{snapshot.shipment.customerName ?? "Not linked"}</p>
            </div>
          </div>

          <label className="block font-medium text-zinc-700">
            Recovery exception
            <select
              value={selectedExceptionId}
              onChange={(event) => chooseException(event.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
            >
              {snapshot.exceptions.map((exception) => (
                <option key={exception.id} value={exception.id}>
                  {exception.type} · {exception.status} · {exception.severity}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block font-medium text-zinc-700">
              Root cause
              <textarea
                value={rootCause}
                onChange={(event) => setRootCause(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block font-medium text-zinc-700">
              Customer impact
              <textarea
                value={customerImpact}
                onChange={(event) => setCustomerImpact(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
          </div>

          <label className="block font-medium text-zinc-700">
            Recovery plan
            <textarea
              value={recoveryPlan}
              onChange={(event) => setRecoveryPlan(event.target.value)}
              disabled={!canEdit}
              className="mt-1 min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
            />
          </label>

          <div className="rounded-xl border border-orange-100 bg-white p-4">
            <p className="font-semibold text-zinc-950">Recovery playbook</p>
            <div className="mt-2 space-y-2">
              {playbookSteps.map((step) => (
                <label key={step.id} className="flex items-center gap-2 text-zinc-700">
                  <input
                    type="checkbox"
                    checked={step.done}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setPlaybookSteps((current) =>
                        current.map((item) => (item.id === step.id ? { ...item, done: event.target.checked } : item)),
                      )
                    }
                  />
                  {step.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block font-medium text-zinc-700">
              Carrier update draft
              <textarea
                value={carrierDraft}
                onChange={(event) => setCarrierDraft(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-36 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block font-medium text-zinc-700">
              Customer update draft
              <textarea
                value={customerDraft}
                onChange={(event) => setCustomerDraft(event.target.value)}
                disabled={!canEdit}
                className="mt-1 min-h-36 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
              >
                Save recovery
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("CARRIER_ESCALATED")}
                className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Mark carrier escalated
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("queue_carrier_update")}
                className="rounded-xl border border-orange-300 bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-950 disabled:opacity-50"
              >
                Queue carrier update
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("log_customer_update")}
                className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900 disabled:opacity-50"
              >
                Log customer update
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save("RECOVERED")}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50"
              >
                Mark recovered
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
