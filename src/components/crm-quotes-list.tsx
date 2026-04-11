"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QuoteRow = {
  id: string;
  title: string;
  status: string;
  quoteNumber: string | null;
  validUntil: string | null;
  subtotal: string | null;
  updatedAt: string;
  account: { id: string; name: string };
  opportunity: { id: string; name: string } | null;
};

export function CrmQuotesList() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/quotes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setQuotes(data.quotes ?? []);
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Quotes</h1>
          <p className="text-sm text-zinc-600">
            Commercial proposals (MVP). Create from an account workspace or add lines on a quote.
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
              <th className="px-4 py-2">Quote #</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No quotes yet. Open an account → Quotes tab to create one.
                </td>
              </tr>
            ) : (
              quotes.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {row.quoteNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/quotes/${row.id}`}
                      className="font-medium text-violet-700 hover:text-violet-900 hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/accounts/${row.account.id}`}
                      className="text-zinc-700 hover:text-violet-800 hover:underline"
                    >
                      {row.account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.status}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {row.subtotal != null ? row.subtotal : "—"}
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
