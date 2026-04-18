"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "contract" | "rfq";

export function PricingSnapshotsNewClient(props: { canContract: boolean; canRfq: boolean }) {
  const router = useRouter();
  const defaultTab: Tab = props.canContract ? "contract" : "rfq";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [contractVersionId, setContractVersionId] = useState("");
  const [quoteResponseId, setQuoteResponseId] = useState("");
  const [shipmentBookingId, setShipmentBookingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Copy the current contract version or RFQ response into an immutable snapshot. Optional shipment booking links
          the economics to a booking record for later UI (booking module).
        </p>

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
            </div>
            <button
              type="submit"
              disabled={busy || !props.canContract}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Freezing…" : "Freeze from contract"}
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
