"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildSalesOrdersListSearch,
  normalizeSalesOrderStatusFilter,
  parseSalesOrdersListQuery,
} from "@/lib/sales-orders";

const SEARCH_DEBOUNCE_MS = 400;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
] as const;

export function SalesOrdersListFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { status: statusRaw, q: qFromUrl } = useMemo(
    () => parseSalesOrdersListQuery(searchParams),
    [searchParams],
  );
  const statusSelectValue = normalizeSalesOrderStatusFilter(statusRaw) ?? "";

  const [qDraft, setQDraft] = useState(qFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  const replaceListQuery = useCallback(
    (patch: Partial<{ status: string; q: string }>) => {
      const nextQs = buildSalesOrdersListSearch(new URLSearchParams(searchParams.toString()), patch);
      router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSearchInput = useCallback(
    (value: string) => {
      setQDraft(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        replaceListQuery({ q: value });
      }, SEARCH_DEBOUNCE_MS);
    },
    [replaceListQuery],
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Filters</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm">
          <span className="font-medium text-zinc-700">Status</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            value={statusSelectValue}
            onChange={(e) => replaceListQuery({ status: e.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-[2] text-sm">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            type="search"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
            placeholder="SO number, customer, external ref…"
            value={qDraft}
            onChange={(e) => onSearchInput(e.target.value)}
          />
        </label>
        {(statusRaw.trim() || qFromUrl) && (
          <button
            type="button"
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            onClick={() => {
              setQDraft("");
              replaceListQuery({ status: "", q: "" });
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
