"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { SearchableSelectField } from "@/components/searchable-select-field";
import { WorkflowHeader } from "@/components/workflow-header";

const SUPPLIER_CUSTOMER_PREFIX = "__supplier__:";

export function SalesOrderCreateForm({
  soNumberHint,
  shipmentHint,
  crmAccounts,
  forwarderSuppliers = [],
  orgUnits = [],
}: {
  soNumberHint: string;
  shipmentHint: {
    id: string;
    shipmentNo: string | null;
    order: { shipToName: string | null; requestedDeliveryDate: Date | null };
  } | null;
  crmAccounts: Array<{
    id: string;
    name: string;
    legalName: string | null;
    accountType: string;
  }>;
  forwarderSuppliers?: Array<{ id: string; name: string; legalName: string | null }>;
  orgUnits?: Array<{ id: string; name: string; code: string; kind: string }>;
}) {
  const router = useRouter();
  const [soNumber, setSoNumber] = useState(soNumberHint);
  const [customerCrmAccountId, setCustomerCrmAccountId] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(
    shipmentHint?.order.requestedDeliveryDate
      ? new Date(shipmentHint.order.requestedDeliveryDate).toISOString().slice(0, 10)
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servedOrgUnitId, setServedOrgUnitId] = useState("");
  const customerOptions = useMemo(() => {
    const crmNameLower = new Set(crmAccounts.map((a) => a.name.trim().toLowerCase()));
    const crmOpts = crmAccounts.map((a) => {
      const partner =
        a.accountType === "AGENT" || a.accountType === "PARTNER"
          ? " · CRM forwarder / partner"
          : "";
      return {
        value: a.id,
        label: `${a.name}${a.legalName ? ` · ${a.legalName}` : ""}${partner}`,
      };
    });
    const supOpts = forwarderSuppliers
      .filter((s) => !crmNameLower.has(s.name.trim().toLowerCase()))
      .map((s) => ({
        value: `${SUPPLIER_CUSTOMER_PREFIX}${s.id}`,
        label: `${s.name}${s.legalName ? ` · ${s.legalName}` : ""} · SRM logistics partner`,
      }));
    return [...crmOpts, ...supOpts].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [crmAccounts, forwarderSuppliers]);

  async function submit() {
    if (!customerCrmAccountId) {
      setError("Customer account is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/sales-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soNumber: soNumber.trim() || null,
        customerCrmAccountId,
        externalRef: externalRef.trim() || null,
        requestedDeliveryDate: requestedDeliveryDate || null,
        shipmentId: shipmentHint?.id || null,
        servedOrgUnitId: servedOrgUnitId.trim() || null,
      }),
    });
    const parsed: unknown = await res.json();
    setBusy(false);
    const payload = parsed as { id?: string };
    if (!res.ok || !payload.id) {
      setError(apiClientErrorMessage(parsed, "Could not create sales order."));
      return;
    }
    router.push(`/sales-orders/${payload.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <WorkflowHeader
        eyebrow="SO creation workflow"
        title="Create Sales Order"
        description="Pick the sold-to party from CRM (any active account type, including forwarder-style partners) or from SRM logistics-only suppliers; the option list opens when you focus the field."
        steps={["Step 1: Core order data", "Step 2: Customer mapping", "Step 3: Create and proceed"]}
      />
      {shipmentHint ? (
        <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Linking shipment {(shipmentHint.shipmentNo || shipmentHint.id).toString()}.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      ) : null}

      <section className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm">
        <label className="text-sm font-medium text-zinc-800">
          SO number
          <input
            value={soNumber}
            onChange={(e) => setSoNumber(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          Customer (CRM or SRM logistics partner)
          <SearchableSelectField
            value={customerCrmAccountId}
            onChange={setCustomerCrmAccountId}
            options={customerOptions}
            placeholder="Click to open, then type to filter…"
            emptyLabel="Select customer…"
            inputClassName="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white shadow-md"
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          External reference (ERP/SO)
          <input
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-zinc-800">
          Requested delivery date
          <input
            type="date"
            value={requestedDeliveryDate}
            onChange={(e) => setRequestedDeliveryDate(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        {orgUnits.length > 0 ? (
          <label className="text-sm font-medium text-zinc-800">
            Order for (optional)
            <span className="mt-0.5 block text-xs font-normal text-zinc-500">
              Which in-tenant org this sales order is for, if you need a dimension beyond customer.
            </span>
            <select
              value={servedOrgUnitId}
              onChange={(e) => setServedOrgUnitId(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
            >
              <option value="">Not specified</option>
              {orgUnits.map((ou) => (
                <option key={ou.id} value={ou.id}>
                  {ou.name}
                  {ou.code ? ` (${ou.code})` : ""} · {ou.kind}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <div className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <ActionButton
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Creating..." : "Create Sales Order"}
        </ActionButton>
        <ActionButton
          variant="secondary"
          onClick={() => router.push("/sales-orders")}
        >
          Cancel
        </ActionButton>
      </div>
    </main>
  );
}
