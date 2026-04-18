"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceIntakeDetailActions(props: {
  intakeId: string;
  canEdit: boolean;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun =
    props.canEdit && (props.status === "PARSED" || props.status === "AUDITED" || props.status === "FAILED");

  async function runAudit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoice-audit/intakes/${props.intakeId}/run-audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(data.error ?? `Audit request failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!canRun || busy}
        onClick={() => void runAudit()}
        className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
      >
        {busy ? "Running…" : props.status === "AUDITED" ? "Re-run audit" : "Run audit vs snapshot"}
      </button>
      {props.status === "AUDITED" ? (
        <p className="text-xs text-zinc-500">Re-run clears any prior manual approval on this intake.</p>
      ) : null}
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
