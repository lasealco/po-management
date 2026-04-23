"use client";

import { useState } from "react";

export function ScriRunMatchButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scri/events/${eventId}/match`, { method: "POST" });
      const payload = (await res.json()) as { error?: string; matchedCount?: number };
      if (!res.ok) {
        setError(payload.error ?? "Request failed.");
        return;
      }
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Matching…" : "Run network match"}
      </button>
      <p className="text-[11px] text-zinc-500">
        Scans shipments, POs, and suppliers in this tenant against event geography (deterministic R2).
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
