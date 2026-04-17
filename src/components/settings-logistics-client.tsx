"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LocationRow = {
  id: string;
  code: string | null;
  name: string;
  type: "CFS" | "WAREHOUSE";
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  isActive: boolean;
};

export function SettingsLogisticsClient({
  initialLocations,
  initialLocationCodes,
}: {
  initialLocations: LocationRow[];
  initialLocationCodes: Array<{
    id: string;
    type: "UN_LOCODE" | "PORT" | "AIRPORT";
    code: string;
    name: string;
    countryCode: string | null;
    isActive: boolean;
    source: string | null;
  }>;
}) {
  const router = useRouter();
  const [locations] = useState(initialLocations);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState(initialLocationCodes);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "UN_LOCODE" | "PORT" | "AIRPORT">("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"UN_LOCODE" | "PORT" | "AIRPORT">("UN_LOCODE");
  const [newCountry, setNewCountry] = useState("");
  const [busy, setBusy] = useState(false);

  async function searchCodes() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    const res = await fetch(`/api/settings/location-codes?${params.toString()}`);
    const payload = (await res.json()) as { rows?: typeof codes; error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Search failed.");
      return;
    }
    setCodes(payload.rows ?? []);
  }

  async function importFromWeb() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/location-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_web" }),
    });
    const payload = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(payload.error ?? "Import failed.");
      return;
    }
    await searchCodes();
    router.refresh();
  }

  async function addCode() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/location-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        countryCode: newCountry.trim().toUpperCase(),
      }),
    });
    const payload = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(payload.error ?? "Save failed.");
      return;
    }
    setNewCode("");
    setNewName("");
    setNewCountry("");
    await searchCodes();
  }

  async function toggleCode(id: string, isActive: boolean) {
    const res = await fetch(`/api/settings/location-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(payload.error ?? "Update failed.");
      return;
    }
    setCodes((prev) => prev.map((row) => (row.id === id ? { ...row, isActive } : row)));
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-base font-semibold text-zinc-900">Logistics partners now live in SRM</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Forwarders, carriers, and related partner master data moved to SRM so procurement and logistics work from one
          profile model (company details, addresses, contacts, and terms).
        </p>
        <div className="mt-3">
          <Link
            href="/srm?kind=logistics"
            className="inline-flex rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            Open SRM logistics partners
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-base font-semibold text-zinc-900">Location code references</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Master table for UN/LOCODE, port, and airport codes. Use this for lane/leg fields.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void importFromWeb()}
            disabled={busy}
            className="rounded bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import from web (UN/LOCODE + Airports)"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code or name..."
            className="rounded border border-zinc-300 px-2 py-1.5 text-xs"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border border-zinc-300 px-2 py-1.5 text-xs"
          >
            <option value="">All types</option>
            <option value="UN_LOCODE">UN/LOCODE</option>
            <option value="PORT">Port</option>
            <option value="AIRPORT">Airport</option>
          </select>
          <button
            type="button"
            onClick={() => void searchCodes()}
            className="rounded border border-zinc-300 px-2 py-1.5 text-xs"
          >
            Search
          </button>
        </div>
        <div className="mt-3 grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-5">
          <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)} className="rounded border border-zinc-300 px-2 py-1.5 text-xs">
            <option value="UN_LOCODE">UN/LOCODE</option>
            <option value="PORT">Port</option>
            <option value="AIRPORT">Airport</option>
          </select>
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code" className="rounded border border-zinc-300 px-2 py-1.5 text-xs" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="rounded border border-zinc-300 px-2 py-1.5 text-xs sm:col-span-2" />
          <input value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="Country" maxLength={2} className="rounded border border-zinc-300 px-2 py-1.5 text-xs" />
          <button type="button" onClick={() => void addCode()} disabled={busy} className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50">
            Add / upsert
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-100">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">{c.type}</td>
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.countryCode ?? "—"}</td>
                  <td className="px-3 py-2">{c.source ?? "—"}</td>
                  <td className="px-3 py-2">{c.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void toggleCode(c.id, !c.isActive)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs"
                    >
                      {c.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

