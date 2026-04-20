"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  name: string;
  code: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
  status: string;
};

export function TariffLegalEntitiesDirectoryClient({
  initialRows,
  canEdit,
}: {
  initialRows: Row[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");

  async function createEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffs/legal-entities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code.trim() || null,
          countryCode: countryCode.trim() || null,
          baseCurrency: baseCurrency.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? `Create failed (${res.status})`);
        return;
      }
      setName("");
      setCode("");
      setCountryCode("");
      setBaseCurrency("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {canEdit ? (
        <form onSubmit={(e) => void createEntity(e)} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">New legal entity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-600">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Country ISO-2</span>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Base currency</span>
              <input
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                placeholder="USD"
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create entity"}
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Country</th>
              <th className="px-4 py-2 font-medium">Currency</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-900">{r.name}</td>
                <td className="px-4 py-2.5 text-zinc-600">{r.code ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{r.countryCode ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{r.baseCurrency ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
