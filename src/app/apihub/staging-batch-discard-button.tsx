"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";

type Props = {
  batchId: string;
  canDiscard: boolean;
};

export function StagingBatchDiscardButton({ batchId, canDiscard }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDiscard) {
    return null;
  }

  async function discard() {
    if (!window.confirm("Discard this staging batch? This cannot be undone.")) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/apihub/staging-batches/${encodeURIComponent(batchId)}/discard`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Discard failed."));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void discard()}
        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        {busy ? "Discarding…" : "Discard batch"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
