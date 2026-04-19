"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";

export type SupplierOption = { id: string; name: string; code: string | null };

export type RecipientRow = {
  id: string;
  displayName: string;
  contactEmail: string | null;
  invitationStatus: string;
  supplier: SupplierOption | null;
  responseId: string | null;
  responseStatus: string | null;
};

export function RfqRecipientsClient({
  requestId,
  canEdit,
  suppliers,
  recipients,
}: {
  requestId: string;
  canEdit: boolean;
  suppliers: SupplierOption[];
  recipients: RecipientRow[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = recipients;

  async function add() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          supplierId: supplierId.trim() || null,
          contactEmail: contactEmail.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add recipient.");
        return;
      }
      setDisplayName("");
      setSupplierId("");
      setContactEmail("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this recipient?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}/recipients/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Remove failed.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function markInvited(id: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}/recipients/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { stub: true, note: "Mailbox integration not enabled — status only." },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pl-4 pr-2">Recipient</th>
              <th className="py-2 pr-2">Recipient id</th>
              <th className="py-2 pr-2">Email</th>
              <th className="py-2 pr-2">Invite</th>
              <th className="py-2 pr-2">Quote</th>
              {canEdit ? <th className="py-2 pr-4">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-zinc-500">
                  No recipients yet. Add forwarders or carriers below.
                </td>
              </tr>
            ) : null}
            {list.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="py-2 pl-4 pr-2">
                  <div className="font-medium text-zinc-900">{r.displayName}</div>
                  {r.supplier ? (
                    <div className="text-xs text-zinc-500">
                      Supplier: {r.supplier.name}
                      {r.supplier.code ? ` (${r.supplier.code})` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 pr-2 align-top">
                  <RecordIdCopy id={r.id} copyButtonLabel="Copy recipient id" />
                </td>
                <td className="py-2 pr-2 text-xs text-zinc-600">{r.contactEmail ?? "—"}</td>
                <td className="py-2 pr-2 text-xs">{r.invitationStatus}</td>
                <td className="py-2 pr-2 text-xs">{r.responseStatus ?? "—"}</td>
                {canEdit ? (
                  <td className="flex flex-wrap gap-2 py-2 pr-4">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void markInvited(r.id)}
                      className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                    >
                      Mark invited (stub)
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void remove(r.id)}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-sm font-medium text-zinc-800">Add recipient</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Display name</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Demo Forwarder — Pricing desk"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Supplier (optional)</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-medium text-zinc-600">Contact email (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="pricing@forwarder.com — for future outbound email"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !displayName.trim()}
            onClick={() => void add()}
            className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            Add recipient
          </button>
        </div>
      ) : null}
    </div>
  );
}
