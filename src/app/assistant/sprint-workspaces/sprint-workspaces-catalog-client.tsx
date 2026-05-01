"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { SprintWorkspaceEntry } from "@/lib/assistant/sprint-workspaces-catalog";

export function SprintWorkspacesCatalogClient({ entries }: { entries: SprintWorkspaceEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((row) => {
      const hay = `${row.sprintLabel} ${row.primaryName} ${row.subtitle} ${row.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="sr-only">Search program track workspaces</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by sprint, name, or topic…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-[var(--arscmp-primary)] focus:ring-2 focus:ring-[var(--arscmp-primary)]"
          autoComplete="off"
        />
      </label>

      <p className="text-xs text-zinc-500">
        Showing <span className="font-medium text-zinc-700">{filtered.length}</span> of {entries.length} workspaces
      </p>

      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((row) => (
          <li key={row.href}>
            <Link
              href={row.href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--arscmp-primary)]">{row.sprintLabel}</span>
                <span className="text-base font-semibold text-zinc-900">{row.primaryName}</span>
              </div>
              <p className="mt-2 text-sm leading-snug text-zinc-600">{row.subtitle}</p>
              {row.note ? <p className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500">{row.note}</p> : null}
              <span className="mt-3 text-xs font-medium text-[var(--arscmp-primary)]">Open workspace →</span>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
          No matches. Try a shorter search or clear the filter.
        </p>
      ) : null}
    </div>
  );
}
