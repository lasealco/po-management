"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CatalogProgramRow = {
  slug: string;
  navLabel: string;
  ampNumber: number;
  title: string;
};

export function AdvancedProgramsCatalogClient({ programs }: { programs: CatalogProgramRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter((p) => {
      const hay = `${p.slug} ${p.navLabel} ${p.title} amp${p.ampNumber}`.toLowerCase();
      return hay.includes(q);
    });
  }, [programs, query]);

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="sr-only">Search advanced programs</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by label, AMP number, or slug…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-[var(--arscmp-primary)] focus:ring-2 focus:ring-[var(--arscmp-primary)]"
          autoComplete="off"
        />
      </label>

      <p className="text-xs text-zinc-500">
        Showing <span className="font-medium text-zinc-700">{filtered.length}</span> of {programs.length} programs
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((program) => (
          <li key={program.slug}>
            <Link
              href={`/assistant/advanced-programs/${program.slug}`}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                AMP{program.ampNumber}
              </span>
              <span className="mt-1 text-base font-semibold text-zinc-900">{program.navLabel}</span>
              <span className="mt-2 line-clamp-2 text-sm leading-snug text-zinc-600">{program.title}</span>
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
