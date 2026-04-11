"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AccountRow = {
  id: string;
  name: string;
  accountType: string;
  lifecycle: string;
  strategicFlag: boolean;
  owner: { name: string };
  _count: { contacts: number; opportunities: number };
};

export function CrmAccountsList() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setAccounts(data.accounts ?? []);
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Accounts</h1>
          <p className="text-sm text-zinc-600">
            Customers and prospects. Click a name for the account workspace.
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
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Lifecycle</th>
              <th className="px-4 py-2">Contacts / Opps</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No accounts yet.
                </td>
              </tr>
            ) : (
              accounts.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/accounts/${row.id}`}
                      className="font-medium text-violet-700 hover:text-violet-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.strategicFlag ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        Strategic
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.accountType}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.lifecycle}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {row._count.contacts} / {row._count.opportunities}
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
