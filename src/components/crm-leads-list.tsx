"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LeadRow = {
  id: string;
  companyName: string;
  status: string;
  owner: { name: string };
  updatedAt: string;
};

export function CrmLeadsList() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/leads");
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Failed to load"));
      setLeads((data as { leads?: LeadRow[] }).leads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Leads</h1>
          <p className="text-sm text-zinc-600">
            Pipeline companies before they become accounts. Open a row to edit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No leads yet. Create one from the Overview tab.
                </td>
              </tr>
            ) : (
              leads.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/leads/${row.id}`}
                      className="font-medium text-violet-700 hover:text-violet-900 hover:underline"
                    >
                      {row.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.status}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.owner.name}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
