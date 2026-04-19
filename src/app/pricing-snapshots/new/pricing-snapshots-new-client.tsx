"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { compositeIncotermRoleHints } from "@/lib/booking-pricing-snapshot/composite-incoterm-suggestions";

type Tab = "contract" | "composite" | "rfq";

const ROLE_SUGGESTIONS = [
  "FORWARDER_HANDLING",
  "PRE_CARRIAGE",
  "MAIN_OCEAN",
  "MAIN_AIR",
  "ON_CARRIAGE",
  "DESTINATION_HANDLING",
  "LAST_MILE",
  "OTHER",
] as const;

export function PricingSnapshotsNewClient(props: { canContract: boolean; canRfq: boolean }) {
  const router = useRouter();
  const defaultTab: Tab = props.canContract ? "contract" : props.canRfq ? "rfq" : "contract";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [contractVersionId, setContractVersionId] = useState("");
  const [quoteResponseId, setQuoteResponseId] = useState("");
  const [shipmentBookingId, setShipmentBookingId] = useState("");
  const [compositeIncoterm, setCompositeIncoterm] = useState("");
  const [compositeRows, setCompositeRows] = useState(() => [
    { role: "FORWARDER_HANDLING", contractVersionId: "" },
    { role: "MAIN_OCEAN", contractVersionId: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compositeIncotermHint = compositeIncotermRoleHints(compositeIncoterm);

  async function submitContract() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/booking-pricing-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "TARIFF_CONTRACT_VERSION",
          contractVersionId: contractVersionId.trim(),
          shipmentBookingId: shipmentBookingId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; snapshot?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.snapshot?.id) router.push(`/pricing-snapshots/${data.snapshot.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitComposite() {
    setBusy(true);
    setError(null);
    try {
      const cleaned = compositeRows
        .map((r) => ({ role: r.role.trim(), contractVersionId: r.contractVersionId.trim() }))
        .filter((r) => r.role && r.contractVersionId);
      if (cleaned.length === 0) {
        setError("Add at least one component with both role and contract version id.");
        return;
      }
      const res = await fetch("/api/booking-pricing-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "COMPOSITE_CONTRACT_VERSION",
          components: cleaned,
          incoterm: compositeIncoterm.trim() || undefined,
          shipmentBookingId: shipmentBookingId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; snapshot?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.snapshot?.id) router.push(`/pricing-snapshots/${data.snapshot.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitRfq() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/booking-pricing-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "QUOTE_RESPONSE",
          quoteResponseId: quoteResponseId.trim(),
          shipmentBookingId: shipmentBookingId.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; snapshot?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.snapshot?.id) router.push(`/pricing-snapshots/${data.snapshot.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Freeze pricing snapshot</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Freeze a single tariff contract version, several versions for one shipment move (e.g. FOB: forwarder
          handling + pre-carriage, then ocean main leg — each row is a published contract version), or an RFQ response.
          Optional shipment booking links the economics to a booking record.
        </p>

        <datalist id="pricing-snapshot-role-hints">
          {ROLE_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!props.canContract}
            onClick={() => setTab("contract")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "contract"
                ? "bg-[var(--arscmp-primary)] text-white shadow-sm"
                : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
            }`}
          >
            From contract version
          </button>
          <button
            type="button"
            disabled={!props.canContract}
            onClick={() => setTab("composite")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "composite"
                ? "bg-[var(--arscmp-primary)] text-white shadow-sm"
                : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
            }`}
          >
            Composite (legs + Incoterm)
          </button>
          <button
            type="button"
            disabled={!props.canRfq}
            onClick={() => setTab("rfq")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "rfq"
                ? "bg-[var(--arscmp-primary)] text-white shadow-sm"
                : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
            }`}
          >
            From RFQ response
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm text-zinc-600">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Shipment booking (optional)
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-inner"
            placeholder="ShipmentBooking id (cuid)"
            value={shipmentBookingId}
            onChange={(e) => setShipmentBookingId(e.target.value)}
          />
          {shipmentBookingId.trim() ? (
            <div className="mt-2">
              <RecordIdCopy id={shipmentBookingId} copyButtonLabel="Copy booking id" />
            </div>
          ) : null}
        </div>

        {tab === "contract" ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitContract();
            }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Contract version id
              </label>
              <input
                required
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-inner"
                placeholder="TariffContractVersion id"
                value={contractVersionId}
                onChange={(e) => setContractVersionId(e.target.value)}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Open a contract in Tariffs → copy the version id from the URL{" "}
                <span className="font-mono">/tariffs/contracts/…/versions/[versionId]</span>.
              </p>
              {contractVersionId.trim() ? (
                <div className="mt-2">
                  <RecordIdCopy id={contractVersionId} copyButtonLabel="Copy version id" />
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={busy || !props.canContract}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Freezing…" : "Freeze from contract"}
            </button>
          </form>
        ) : tab === "composite" ? (
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submitComposite();
            }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Incoterm (optional, for context)
              </label>
              <input
                className="mt-2 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm uppercase text-zinc-900 shadow-inner"
                placeholder="FOB, EXW, DDP…"
                maxLength={16}
                value={compositeIncoterm}
                onChange={(e) => setCompositeIncoterm(e.target.value)}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Stored on the snapshot for audit; which legs you include is your choice here (e.g. FOB may be only
                forwarder handling + pre-carriage, without ocean if the carrier bills the buyer separately).
              </p>
              {compositeIncotermHint ? (
                <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50/90 px-3 py-2 text-xs text-sky-950">
                  <span className="font-semibold">Suggested roles for this Incoterm: </span>
                  {compositeIncotermHint}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Components (order matters)</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setCompositeRows((rows) => [...rows, { role: "OTHER", contractVersionId: "" }])
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Add leg
                </button>
              </div>
              {compositeRows.map((row, idx) => (
                <div
                  key={`${idx}-${row.role}`}
                  className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
                >
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Role</label>
                    <input
                      list="pricing-snapshot-role-hints"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-inner"
                      placeholder="e.g. PRE_CARRIAGE"
                      value={row.role}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCompositeRows((rows) => rows.map((r, i) => (i === idx ? { ...r, role: v } : r)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Contract version id
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-inner"
                      placeholder="TariffContractVersion id"
                      value={row.contractVersionId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCompositeRows((rows) => rows.map((r, i) => (i === idx ? { ...r, contractVersionId: v } : r)));
                      }}
                    />
                  </div>
                  <div className="flex items-end justify-end sm:justify-center">
                    <button
                      type="button"
                      disabled={busy || compositeRows.length <= 1}
                      onClick={() => setCompositeRows((rows) => rows.filter((_, i) => i !== idx))}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy || !props.canContract}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Freezing…" : "Freeze composite snapshot"}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRfq();
            }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Quote response id
              </label>
              <input
                required
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-inner"
                placeholder="QuoteResponse id"
                value={quoteResponseId}
                onChange={(e) => setQuoteResponseId(e.target.value)}
              />
              <p className="mt-2 text-xs text-zinc-500">
                From RFQ → open a response editor; the response id is in the URL path.
              </p>
              {quoteResponseId.trim() ? (
                <div className="mt-2">
                  <RecordIdCopy id={quoteResponseId} copyButtonLabel="Copy response id" />
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={busy || !props.canRfq}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Freezing…" : "Freeze from RFQ"}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
      </section>
    </main>
  );
}
