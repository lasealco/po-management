"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  accountId: string;
  account: { id: string; name: string };
};

export function CrmContactsList() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/contacts");
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Failed to load"));
      setContacts((data as { contacts?: ContactRow[] }).contacts ?? []);
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Contacts</h1>
          <p className="text-sm text-zinc-600">
            People linked to accounts. Add contacts from an account page.
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
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No contacts yet.
                </td>
              </tr>
            ) : (
              contacts.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/accounts/${row.account.id}`}
                      className="text-violet-700 hover:text-violet-900 hover:underline"
                    >
                      {row.account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.title ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{row.email ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
