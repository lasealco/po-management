"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiHubConnectorDto } from "@/lib/apihub/connector-dto";

type Props = {
  initialConnectors: ApiHubConnectorDto[];
  canCreate: boolean;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ConnectorsSection({ initialConnectors, canCreate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addStub() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create connector.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="connectors"
      className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Phase 1</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Connectors</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Registry rows for partner or internal sources. This build stores{" "}
            <span className="font-medium">metadata only</span> — no secrets, OAuth, or background sync yet.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => void addStub()}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add stub connector"}
          </button>
        ) : (
          <p className="max-w-xs text-right text-sm text-zinc-600">
            Choose a demo user in{" "}
            <a href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Settings → Demo session
            </a>{" "}
            to create registry rows via the API.
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {initialConnectors.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">No connectors yet</p>
          <p className="mt-2">
            {canCreate
              ? "Use “Add stub connector” to insert a draft row for UI and API checks."
              : "Once a demo session is active, you can add stub rows from this page or POST /api/apihub/connectors."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sync</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
              {initialConnectors.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{c.sourceKind}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.lastSyncAt ? formatWhen(c.lastSyncAt) : "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.healthSummary ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{formatWhen(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        API: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">GET /api/apihub/connectors</code>,{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">POST /api/apihub/connectors</code> (demo tenant +
        demo actor required; same gate as listing above).
      </p>
    </section>
  );
}
