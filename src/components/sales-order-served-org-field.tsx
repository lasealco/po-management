"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/components/action-button";

export function SalesOrderServedOrgField({
  salesOrderId,
  orgUnitOptions,
  canEdit,
  initial,
}: {
  salesOrderId: string;
  orgUnitOptions: Array<{ id: string; name: string; code: string; kind: string }>;
  canEdit: boolean;
  initial: { id: string; name: string; code: string; kind: string } | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales-orders/${salesOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servedOrgUnitId: value.trim() || null }),
    });
    const parsed: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(parsed, "Could not update order-for org."));
      return;
    }
    router.refresh();
  }

  if (!canEdit && !initial) {
    return <span className="text-zinc-400">—</span>;
  }

  if (!canEdit) {
    return <span className="text-zinc-900">{[initial!.name, initial!.code].filter(Boolean).join(" · ")}</span>;
  }

  if (orgUnitOptions.length === 0) {
    if (!initial) return <span className="text-zinc-400">—</span>;
    return <span className="text-zinc-900">{[initial.name, initial.code].filter(Boolean).join(" · ")}</span>;
  }

  const f = "w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900";

  return (
    <div className="space-y-1">
      {error ? (
        <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900">{error}</p>
      ) : null}
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={f}
        aria-label="Order for (org unit)"
      >
        <option value="">Not specified</option>
        {orgUnitOptions.map((ou) => (
          <option key={ou.id} value={ou.id}>
            {ou.name}
            {ou.code ? ` (${ou.code})` : ""} · {ou.kind}
          </option>
        ))}
      </select>
      <ActionButton type="button" className="text-xs" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save order-for org"}
      </ActionButton>
    </div>
  );
}
