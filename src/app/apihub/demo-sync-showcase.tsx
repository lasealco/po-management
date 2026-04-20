"use client";

import { useMemo, useState } from "react";

type DemoStep = {
  key: string;
  label: string;
  detail: string;
  durationMs: number;
};

type DemoResult = {
  createdPurchaseOrders: number;
  updatedSkus: number;
  warnings: number;
  runtimeMs: number;
};

const DEMO_STEPS: DemoStep[] = [
  {
    key: "queued",
    label: "Queued",
    detail: "Connector run requested and reserved for execution.",
    durationMs: 500,
  },
  {
    key: "pulling",
    label: "Pulling",
    detail: "Fetching source payload from partner feed stub.",
    durationMs: 700,
  },
  {
    key: "transforming",
    label: "Transforming",
    detail: "Applying mapping rules and normalization.",
    durationMs: 900,
  },
  {
    key: "validating",
    label: "Validating",
    detail: "Checking required fields, types, and business guardrails.",
    durationMs: 800,
  },
  {
    key: "posted",
    label: "Posted",
    detail: "Writing accepted records and emitting audit events.",
    durationMs: 650,
  },
];

const SOURCE_PAYLOAD = {
  sourceSystem: "Storefront-Demo",
  batchId: "BATCH-INVESTOR-0420",
  submittedAt: "2026-04-20T11:00:00.000Z",
  orders: [
    {
      externalOrderId: "SO-1182",
      warehouseCode: "WH-DEMO-DC1",
      buyerName: "Greenfield Retail GmbH",
      items: [
        { sku: "CAB-USB-C-2M", quantity: 120, unitPrice: 4.9 },
        { sku: "HDMI-2.1-1M", quantity: 80, unitPrice: 6.25 },
      ],
    },
  ],
};

const MAPPED_PAYLOAD = {
  intakeId: "INGEST-2026-04-20-001",
  tenant: "demo-company",
  purchaseOrders: [
    {
      poNumber: "PO-640192",
      destinationWarehouseCode: "WH-DEMO-DC1",
      customerName: "Greenfield Retail GmbH",
      lines: [
        { sku: "CAB-USB-C-2M", qty: 120, unitCost: 4.9 },
        { sku: "HDMI-2.1-1M", qty: 80, unitCost: 6.25 },
      ],
      sourceReference: "SO-1182",
    },
  ],
  warnings: ["1 item had optional notes dropped because field was null."],
};

const DEMO_RESULT: DemoResult = {
  createdPurchaseOrders: 3,
  updatedSkus: 2,
  warnings: 1,
  runtimeMs: 3550,
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function statusClass(state: "pending" | "active" | "done") {
  if (state === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (state === "active") {
    return "border-[var(--arscmp-primary)] bg-blue-50 text-blue-800";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-500";
}

export function DemoSyncShowcase() {
  const [running, setRunning] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [completedCount, setCompletedCount] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<"source" | "mapped">("source");

  async function runDemoSync() {
    setRunning(true);
    setActiveIdx(-1);
    setCompletedCount(0);
    setStartedAt(new Date().toISOString());
    setFinishedAt(null);
    setSelectedView("source");

    for (let idx = 0; idx < DEMO_STEPS.length; idx += 1) {
      setActiveIdx(idx);
      if (idx >= 2) {
        setSelectedView("mapped");
      }
      await sleep(DEMO_STEPS[idx].durationMs);
      setCompletedCount(idx + 1);
    }

    setActiveIdx(-1);
    setFinishedAt(new Date().toISOString());
    setRunning(false);
  }

  const activeStepDetail = useMemo(() => {
    if (activeIdx < 0 || activeIdx >= DEMO_STEPS.length) {
      return "Ready to run investor demo sync.";
    }
    return DEMO_STEPS[activeIdx].detail;
  }, [activeIdx]);

  const isCompleted = completedCount === DEMO_STEPS.length;

  return (
    <section id="demo-sync" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Investor demo</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Live example: connector sync run</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Simulated end-to-end run showing how API Hub ingests partner data, maps fields, validates records, and
            emits a measurable business outcome with audit-ready traceability.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runDemoSync()}
          disabled={running}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {running ? "Running demo sync..." : "Run demo sync"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Execution timeline</p>
          <div className="mt-3 space-y-2">
            {DEMO_STEPS.map((step, idx) => {
              const state: "pending" | "active" | "done" =
                idx < completedCount ? "done" : idx === activeIdx ? "active" : "pending";
              return (
                <div key={step.key} className={`rounded-lg border px-3 py-2 text-sm ${statusClass(state)}`}>
                  <p className="font-semibold">
                    {idx + 1}. {step.label}
                  </p>
                  <p className="mt-1 text-xs opacity-90">{step.detail}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-600">{activeStepDetail}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payload preview</p>
            <div className="inline-flex rounded-lg border border-zinc-200 p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedView("source")}
                className={`rounded px-2 py-1 ${selectedView === "source" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => setSelectedView("mapped")}
                className={`rounded px-2 py-1 ${selectedView === "mapped" ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
              >
                Mapped
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-3 text-xs text-zinc-100">
            {JSON.stringify(selectedView === "source" ? SOURCE_PAYLOAD : MAPPED_PAYLOAD, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Created POs</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{isCompleted ? DEMO_RESULT.createdPurchaseOrders : "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Updated SKUs</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{isCompleted ? DEMO_RESULT.updatedSkus : "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Warnings</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{isCompleted ? DEMO_RESULT.warnings : "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Runtime</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {isCompleted ? `${Math.round(DEMO_RESULT.runtimeMs / 1000)}s` : "-"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        {startedAt ? `Started: ${new Date(startedAt).toLocaleTimeString()}` : "Not started."}
        {finishedAt ? ` Completed: ${new Date(finishedAt).toLocaleTimeString()}.` : ""}
      </p>
    </section>
  );
}
