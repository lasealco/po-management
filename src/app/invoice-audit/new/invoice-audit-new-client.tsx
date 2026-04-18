"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DraftLine = {
  lineNo: number;
  rawDescription: string;
  amount: string;
  currency: string;
  unitBasis: string;
  equipmentType: string;
  chargeStructureHint: string;
};

export function InvoiceAuditNewClient() {
  const router = useRouter();
  const [snapshotId, setSnapshotId] = useState("");
  const [vendorLabel, setVendorLabel] = useState("");
  const [externalInvoiceNo, setExternalInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [polCode, setPolCode] = useState("");
  const [podCode, setPodCode] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { lineNo: 1, rawDescription: "", amount: "", currency: "USD", unitBasis: "", equipmentType: "", chargeStructureHint: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addLine() {
    setLines((prev) => {
      const nextNo = prev.length ? Math.max(...prev.map((l) => l.lineNo)) + 1 : 1;
      const cur = (currency || "USD").trim().toUpperCase().slice(0, 3) || "USD";
      return [
        ...prev,
        {
          lineNo: nextNo,
          rawDescription: "",
          amount: "",
          currency: cur,
          unitBasis: "",
          equipmentType: "",
          chargeStructureHint: "",
        },
      ];
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        bookingPricingSnapshotId: snapshotId.trim(),
        vendorLabel: vendorLabel.trim() || null,
        externalInvoiceNo: externalInvoiceNo.trim() || null,
        invoiceDate: invoiceDate.trim() || null,
        currency: currency.trim() || "USD",
        polCode: polCode.trim() || null,
        podCode: podCode.trim() || null,
        lines: lines.map((l) => ({
          lineNo: l.lineNo,
          rawDescription: l.rawDescription.trim(),
          amount: l.amount.trim(),
          currency: (l.currency || currency).trim() || "USD",
          unitBasis: l.unitBasis.trim() || null,
          equipmentType: l.equipmentType.trim() || null,
          chargeStructureHint: l.chargeStructureHint.trim() || null,
        })),
      };
      const res = await fetch("/api/invoice-audit/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; intake?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      if (data.intake?.id) router.push(`/invoice-audit/${data.intake.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">New invoice intake</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Link a booking pricing snapshot, optional POL/POD (UN/LOCODE), then enter parsed lines with equipment and unit
          basis when known. Matching uses ocean rules (equipment, geography, unit basis, alias dictionary, all-in vs
          separated basket).
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pricing snapshot id</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              placeholder="BookingPricingSnapshot id (cuid)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vendor label</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={vendorLabel}
                onChange={(e) => setVendorLabel(e.target.value)}
                placeholder="Carrier / forwarder name"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Invoice no.</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={externalInvoiceNo}
                onChange={(e) => setExternalInvoiceNo(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Invoice date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Header currency</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={3}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">POL (loading)</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
                value={polCode}
                onChange={(e) => setPolCode(e.target.value)}
                placeholder="e.g. USNYC"
                maxLength={8}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">POD (discharge)</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
                value={podCode}
                onChange={(e) => setPodCode(e.target.value)}
                placeholder="e.g. DEHAM"
                maxLength={8}
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Parsed lines</h2>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            >
              Add line
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {lines.map((ln, idx) => (
              <div key={ln.lineNo} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <p className="text-xs font-medium text-zinc-500">Line {ln.lineNo}</p>
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                  placeholder="Description (e.g. BAF, THC, Ocean freight)"
                  value={ln.rawDescription}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, rawDescription: v } : x)));
                  }}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
                    placeholder="Amount"
                    value={ln.amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: v } : x)));
                    }}
                  />
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                    placeholder="USD"
                    value={ln.currency}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, currency: v } : x)));
                    }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-inner"
                    placeholder="Unit basis (e.g. PER_CONTAINER)"
                    value={ln.unitBasis}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitBasis: v } : x)));
                    }}
                  />
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-inner"
                    placeholder="Equipment (e.g. 40HC)"
                    value={ln.equipmentType}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, equipmentType: v } : x)));
                    }}
                  />
                </div>
                <div className="mt-2">
                  <label className="text-xs text-zinc-500">Charge structure hint</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                    value={ln.chargeStructureHint}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, chargeStructureHint: v } : x)));
                    }}
                  >
                    <option value="">Auto (single line may detect all-in)</option>
                    <option value="ALL_IN">ALL_IN (compare to snapshot basket / RFQ total)</option>
                    <option value="ITEMIZED">ITEMIZED (per-line vs snapshot)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-8 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save intake"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}
