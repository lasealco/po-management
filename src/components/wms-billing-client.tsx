"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

type BillingPayload = {
  profileSourceNote?: string;
  unbilledEventCount?: number;
  rates: Array<{
    id: string;
    code: string;
    description: string | null;
    movementType: string | null;
    amountPerUnit: string;
    currency: string;
    isActive: boolean;
  }>;
  events: Array<{
    id: string;
    profileSource: string;
    crmAccount: { id: string; name: string } | null;
    movementType: string;
    quantity: string;
    rateCode: string;
    unitRate: string;
    amount: string;
    currency: string;
    occurredAt: string;
    warehouse: { id: string; code: string | null; name: string };
    product: { id: string; productCode: string | null; sku: string | null; name: string };
    invoiceRun: { id: string; runNo: string; status: string } | null;
  }>;
  invoiceRuns: Array<{
    id: string;
    runNo: string;
    profileSource: string;
    periodFrom: string;
    periodTo: string;
    status: string;
    totalAmount: string;
    currency: string;
    createdAt: string;
    lineCount: number;
    eventCount: number;
    hasCsv: boolean;
  }>;
  error?: string;
};

export function WmsBillingClient({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/wms/billing", { cache: "no-store" });
    const payload = (await res.json()) as BillingPayload & { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Could not load billing.");
      return;
    }
    setData(payload);
    setError(null);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/wms/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Request failed.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-8 text-sm text-zinc-600">Loading billing…</main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">WMS billing</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Phase B: immutable billing events materialized from inventory movements, simple rate cards, and
          draft invoice runs with CSV export. Ops truth stays in <span className="font-medium">InventoryMovement</span>; this layer is for charging only.
        </p>
        {data.profileSourceNote ? (
          <p className="mt-2 text-xs text-zinc-500">{data.profileSourceNote}</p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-600">
          Commercial profiles (Phase C) will feed rates later. For now you can cross-check commercial work in{" "}
          <Link href="/crm/quotes" className="font-medium text-violet-700 underline-offset-2 hover:underline">
            CRM → Quotes
          </Link>
          .
        </p>
      </header>

      {error ? (
        <p className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Unbilled events</h2>
        <p className="mt-1 text-2xl font-semibold text-zinc-800">{data.unbilledEventCount ?? 0}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Events with no invoice run. Sync from movements first, then create an invoice for a period.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => void postAction({ action: "ensure_default_rates" })}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
          >
            Ensure default rates
          </button>
          <button
            type="button"
            disabled={!canEdit || busy}
            onClick={() => void postAction({ action: "sync_events_from_movements" })}
            className="rounded border border-arscmp-primary bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Sync events from movements
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Create invoice run</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Includes all <strong>unbilled</strong> events whose <code className="rounded bg-zinc-100 px-1">occurredAt</code> falls in the range (inclusive).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-zinc-600">
            Period from
            <input
              type="datetime-local"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            Period to
            <input
              type="datetime-local"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>
          <button
            type="button"
            disabled={!canEdit || busy || !periodFrom || !periodTo}
            onClick={() => {
              const from = new Date(periodFrom);
              const to = new Date(periodTo);
              void postAction({
                action: "create_invoice_run",
                periodFrom: from.toISOString(),
                periodTo: to.toISOString(),
              });
            }}
            className="rounded border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create draft invoice
          </button>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Rate card</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Code</th>
                <th className="px-2 py-1">Movement</th>
                <th className="px-2 py-1">Per unit</th>
                <th className="px-2 py-1">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.rates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-zinc-500">
                    No rates — use &quot;Ensure default rates&quot; or seed the database.
                  </td>
                </tr>
              ) : (
                data.rates.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1 font-mono text-xs">{r.code}</td>
                    <td className="px-2 py-1 text-zinc-700">{r.movementType ?? "— (fallback)"}</td>
                    <td className="px-2 py-1">
                      {r.amountPerUnit} {r.currency}
                    </td>
                    <td className="px-2 py-1">{r.isActive ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Invoice runs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">Run</th>
                <th className="px-2 py-1">Period</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Total</th>
                <th className="px-2 py-1">Lines / events</th>
                <th className="px-2 py-1">CSV</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.invoiceRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-zinc-500">
                    No invoice runs yet.
                  </td>
                </tr>
              ) : (
                data.invoiceRuns.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1 font-medium text-zinc-900">{r.runNo}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">
                      {new Date(r.periodFrom).toLocaleString()} → {new Date(r.periodTo).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">{r.status}</td>
                    <td className="px-2 py-1">
                      {r.totalAmount} {r.currency}
                    </td>
                    <td className="px-2 py-1 text-zinc-600">
                      {r.lineCount} / {r.eventCount}
                    </td>
                    <td className="px-2 py-1">
                      {r.hasCsv ? (
                        <a
                          href={`/api/wms/billing?csvRun=${encodeURIComponent(r.id)}`}
                          className="text-violet-700 underline-offset-2 hover:underline"
                        >
                          Download
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit && r.status === "DRAFT" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void postAction({ action: "post_invoice_run", invoiceRunId: r.id })}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-800 disabled:opacity-40"
                        >
                          Post
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900">Recent billing events</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Profile</th>
                <th className="px-2 py-1">CRM</th>
                <th className="px-2 py-1">Qty</th>
                <th className="px-2 py-1">Amount</th>
                <th className="px-2 py-1">Rate</th>
                <th className="px-2 py-1">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {data.events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-zinc-500">
                    No events yet. Sync from movements after rates exist.
                  </td>
                </tr>
              ) : (
                data.events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-2 py-1 text-xs text-zinc-600">
                      {new Date(e.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">{e.movementType}</td>
                    <td className="px-2 py-1 text-xs text-zinc-600">{e.profileSource}</td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {e.crmAccount ? e.crmAccount.name : "—"}
                    </td>
                    <td className="px-2 py-1">{e.quantity}</td>
                    <td className="px-2 py-1 font-medium">
                      {e.amount} {e.currency}
                    </td>
                    <td className="px-2 py-1 text-xs text-zinc-600">{e.rateCode}</td>
                    <td className="px-2 py-1 text-xs text-zinc-600">
                      {e.invoiceRun ? e.invoiceRun.runNo : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
