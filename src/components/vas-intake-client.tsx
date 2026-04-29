"use client";

import { useState } from "react";
import Link from "next/link";

import { apiClientErrorMessage } from "@/lib/api-client-error";

export function VasIntakeClient(props: {
  warehouses: { id: string; code: string | null; name: string }[];
  crmAccounts: { id: string; name: string }[];
  canSubmit: boolean;
}) {
  const [warehouseId, setWarehouseId] = useState(props.warehouses[0]?.id ?? "");
  const [crmAccountId, setCrmAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit() {
    setOkMsg(null);
    setError(null);
    if (!props.canSubmit) {
      setError("You need WMS operations edit access (or full org.wms edit) to submit.");
      return;
    }
    const wh = warehouseId.trim();
    const crm = crmAccountId.trim();
    const t = title.trim();
    if (!wh || !crm || !t) {
      setError("Warehouse, CRM account, and title are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/wms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_customer_vas_work_order",
          warehouseId: wh,
          crmAccountId: crm,
          workOrderTitle: t,
          workOrderDescription: description.trim() ? description.trim() : null,
        }),
      });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        setError(apiClientErrorMessage(parsed, "Could not create work order."));
        setBusy(false);
        return;
      }
      const data = parsed as { workOrderNo?: string };
      setOkMsg(data.workOrderNo ? `Submitted · ${data.workOrderNo}` : "Submitted.");
      setTitle("");
      setDescription("");
      setBusy(false);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 1</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Pick warehouse & account</p>
            <p className="mt-0.5 text-xs text-zinc-600">Scope execution to one DC and the CRM bill-to / shipper.</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 2</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Describe the service</p>
            <p className="mt-0.5 text-xs text-zinc-600">Operators pick up VALUE_ADD steps from Operations.</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Step 3</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">Submit intake</p>
            <p className="mt-0.5 text-xs text-zinc-600">Creates a portal-marked work order for floor execution.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-700">Warehouse</span>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select warehouse</option>
            {props.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code ?? w.name} · {w.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-zinc-700">CRM account</span>
          <select
            value={crmAccountId}
            onChange={(e) => setCrmAccountId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select account</option>
            {props.crmAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-zinc-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Co-pack · shrink bundle · QA sample pulls"
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-zinc-700">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What should warehouse ops validate before quoting?"
            className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            {okMsg}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy || !props.canSubmit}
          onClick={() => void submit()}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Submit VAS request
        </button>
        {!props.canSubmit ? (
          <p className="mt-3 text-xs text-zinc-500">
            View-only: ask an operator with <span className="font-medium text-zinc-800">org.wms.operations → edit</span>{" "}
            (or <span className="font-medium text-zinc-800">org.wms → edit</span>) to submit.
          </p>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500">
        Same tenant guardrails as Operations — requests create{" "}
        <span className="font-medium text-zinc-800">CUSTOMER_PORTAL</span> intake rows; BOM costing estimates are set in
        Operations per <span className="font-medium text-zinc-800">docs/wms/WMS_VAS_BF09.md</span>.
      </p>
      <Link href="/wms/operations" className="text-sm font-semibold text-[var(--arscmp-primary)] hover:underline">
        ← Back to WMS Operations
      </Link>
    </div>
  );
}
