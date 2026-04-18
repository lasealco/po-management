"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";

type SnapshotOption = {
  id: string;
  sourceType: string;
  sourceSummary: string | null;
  currency: string;
  totalEstimatedCost: string;
  frozenAt: string;
};

type DraftLine = {
  lineNo: number;
  rawDescription: string;
  amount: string;
  currency: string;
  unitBasis: string;
  equipmentType: string;
  chargeStructureHint: string;
};

export function InvoiceAuditNewClient(props: { initialSnapshotId?: string }) {
  const router = useRouter();
  const [snapshotId, setSnapshotId] = useState((props.initialSnapshotId ?? "").trim());
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
  const [snapshotOptions, setSnapshotOptions] = useState<SnapshotOption[]>([]);
  const [snapshotOptionsError, setSnapshotOptionsError] = useState<string | null>(null);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [runAuditAfterSave, setRunAuditAfterSave] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshots() {
      setSnapshotsLoading(true);
      setSnapshotOptionsError(null);
      try {
        const res = await fetch("/api/invoice-audit/pricing-snapshot-options");
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          snapshots?: SnapshotOption[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setSnapshotOptionsError(data.error ?? `Could not load snapshots (${res.status}). Paste an id manually.`);
          return;
        }
        setSnapshotOptions(Array.isArray(data.snapshots) ? data.snapshots : []);
      } finally {
        if (!cancelled) setSnapshotsLoading(false);
      }
    }
    void loadSnapshots();
    return () => {
      cancelled = true;
    };
  }, []);

  function fillDemoExample() {
    setVendorLabel("Demo carrier");
    setExternalInvoiceNo("DEMO-OCEAN-001");
    setPolCode("USNYC");
    setPodCode("DEHAM");
    setCurrency("USD");
    setLines([
      {
        lineNo: 1,
        rawDescription: "Ocean freight FCL 40HC base rate",
        amount: "2500",
        currency: "USD",
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: "",
      },
      {
        lineNo: 2,
        rawDescription: "Bunker adjustment factor (BAF)",
        amount: "350",
        currency: "USD",
        unitBasis: "",
        equipmentType: "",
        chargeStructureHint: "",
      },
      {
        lineNo: 3,
        rawDescription: "Terminal handling charge origin",
        amount: "185",
        currency: "USD",
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: "",
      },
    ]);
  }

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
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        migrationsHint?: string;
        intake?: { id: string };
      };
      if (!res.ok) {
        setError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      const intakeId = data.intake?.id;
      if (!intakeId) {
        setError("Save succeeded but no intake id was returned.");
        return;
      }
      if (runAuditAfterSave) {
        const auditRes = await fetch(`/api/invoice-audit/intakes/${intakeId}/run-audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const auditData = (await auditRes.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
        if (!auditRes.ok) {
          setError(
            `Intake saved, but audit failed (${auditRes.status}): ${formatInvoiceAuditApiError(auditData, auditRes.status)} Open the intake to inspect and re-run audit.`,
          );
          router.push(`/invoice-audit/${intakeId}`);
          return;
        }
      }
      router.push(`/invoice-audit/${intakeId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">New intake · Step 1 of 2</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">New invoice intake</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Link a booking pricing snapshot, optional POL/POD (UN/LOCODE), then enter parsed lines with equipment and unit
          basis when known. Matching uses ocean rules (equipment, geography, unit basis, alias dictionary, all-in vs
          separated basket). Step 2 is parsed lines below; after save, closeout continues on the intake detail page.
        </p>
        <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-xs text-zinc-700">
          <span className="font-semibold text-zinc-800">Prerequisites:</span> DB migrations applied (
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">npm run db:migrate</code>
          ). For a repeatable demo intake after you have at least one snapshot, run{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">USE_DOTENV_LOCAL=1 npm run db:seed:invoice-audit-demo</code>{" "}
          from the repo root.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fillDemoExample()}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Fill example lines (demo)
          </button>
          <span className="text-xs text-zinc-500">
            Fills POL/POD and three typical FCL lines (adjust amounts to your snapshot). Then pick a snapshot and save.
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pricing snapshot</label>
              <Link
                href="/pricing-snapshots"
                className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
              >
                Open snapshot library
              </Link>
            </div>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
              value=""
              disabled={snapshotsLoading || snapshotOptions.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setSnapshotId(v);
              }}
            >
              <option value="">
                {snapshotsLoading
                  ? "Loading recent snapshots…"
                  : snapshotOptions.length === 0
                    ? "No snapshots in tenant (freeze one first, or paste id below)"
                    : "Pick a recent snapshot…"}
              </option>
              {snapshotOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.sourceSummary ?? s.sourceType).slice(0, 72)}
                  {" · "}
                  {s.totalEstimatedCost} {s.currency}
                </option>
              ))}
            </select>
            {snapshotOptionsError ? <p className="mt-1 text-xs text-amber-800">{snapshotOptionsError}</p> : null}
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Snapshot id (paste or pick above)
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              placeholder="BookingPricingSnapshot id (cuid)"
            />
            {snapshotId.trim() ? (
              <p className="mt-2 text-xs">
                <Link
                  href={`/pricing-snapshots/${encodeURIComponent(snapshotId.trim())}`}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  Open snapshot (audit hints and geography)
                </Link>
              </p>
            ) : null}
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
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">POL (origin)</label>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">New intake · Step 2 of 2</p>
          <div className="mt-1 flex items-center justify-between gap-2">
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

        <label className="mt-8 flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={runAuditAfterSave}
            onChange={(e) => setRunAuditAfterSave(e.target.checked)}
          />
          <span>
            <span className="font-medium">Run audit after save</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Matches lines against the snapshot immediately so you can verify outcomes in one step (uncheck to save
              only).
            </span>
          </span>
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {busy ? (runAuditAfterSave ? "Saving and auditing…" : "Saving…") : runAuditAfterSave ? "Save and run audit" : "Save intake"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  );
}
