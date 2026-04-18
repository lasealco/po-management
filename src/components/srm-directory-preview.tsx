"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type SrmDirectoryRow = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  orderCount: number;
  srmCategory: "product" | "logistics";
  approvalStatus: "pending_approval" | "approved" | "rejected";
};

export function SrmDirectoryPreview({ rows }: { rows: SrmDirectoryRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const cat =
        r.srmCategory === "logistics" ? "logistics" : "product";
      const blob = `${r.name} ${r.code ?? ""} ${cat}`.toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-zinc-800">
        Search suppliers
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or code"
          className="mt-1.5 w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400"
          autoComplete="off"
        />
      </label>
      <p className="mt-2 text-xs text-zinc-500">
        Search by name or code. Use the directory tabs for product vs logistics lists.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3 text-center">POs (history)</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-900">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No suppliers match this search.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{r.code ?? "—"}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-zinc-700">{r.orderCount}</td>
                  <td className="px-4 py-3 text-xs capitalize text-zinc-600">{r.srmCategory}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.approvalStatus === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.approvalStatus === "pending_approval"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {r.approvalStatus === "pending_approval"
                        ? "Pending"
                        : r.approvalStatus === "approved"
                          ? "Approved"
                          : "Rejected"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {r.isActive ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/srm/${r.id}`}
                      className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
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
