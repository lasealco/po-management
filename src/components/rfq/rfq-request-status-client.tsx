"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = ["DRAFT", "OPEN", "CLOSED", "AWARDED", "CANCELLED"] as const;

export function RfqRequestStatusClient({
  requestId,
  initialStatus,
  canEdit,
}: {
  requestId: string;
  initialStatus: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      const res = await fetch(`/api/rfq/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(j.error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <label className="text-sm">
        <span className="font-medium text-zinc-700">RFQ status</span>
        <select
          className="mt-1 block rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={pending || status === initialStatus}
        onClick={() => void save()}
        className="rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
      >
        Update status
      </button>
    </div>
  );
}
