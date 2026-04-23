"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScriCtAlertButton({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAlert() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scri/events/${eventId}/control-tower-alert`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; ctPath?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not create Control Tower alert.");
        return;
      }
      if (payload.ctPath) {
        router.push(payload.ctPath);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Control Tower</p>
      <p className="mt-1 text-xs text-zinc-600">
        Open a shipment alert from the top matched booking (requires R2 shipment match and Control Tower edit).
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void createAlert()}
        className="mt-3 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create shipment alert"}
      </button>
    </div>
  );
}
