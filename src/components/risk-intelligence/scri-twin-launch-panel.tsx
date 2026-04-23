"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScriTwinLaunchPanel({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scri/events/${eventId}/twin-scenario`, { method: "POST" });
      const payload = (await res.json()) as {
        error?: string;
        scenarioPath?: string;
      };
      if (!res.ok) {
        setError(payload.error ?? "Could not launch twin scenario.");
        return;
      }
      if (payload.scenarioPath) {
        router.push(payload.scenarioPath);
        return;
      }
      setError("Unexpected response from server.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Supply Chain Twin (R6)</p>
        <p className="mt-2 text-sm text-zinc-600">
          Launch a what-if scenario from this event when you have{" "}
          <span className="font-medium text-zinc-800">Risk intelligence → edit</span> and the{" "}
          <span className="font-medium text-zinc-800">Supply Chain Twin</span> preview enabled for your session.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Supply Chain Twin (R6)</p>
      <p className="mt-1 text-xs text-zinc-500">Scenario launch from this risk event</p>
      <p className="mt-3 text-sm text-zinc-700">
        Creates a <span className="font-medium text-zinc-900">twin scenario draft</span>, upserts a matching{" "}
        <span className="font-medium text-zinc-900">risk signal</span>, and records an ingest audit row. You can refine
        the draft in the twin workspace.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void launch()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Launching…" : "Launch twin scenario"}
        </button>
        <Link
          href="/supply-chain-twin/scenarios"
          className="text-sm font-medium text-amber-800 underline-offset-2 hover:underline"
        >
          All scenarios
        </Link>
      </div>
    </section>
  );
}
