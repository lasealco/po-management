"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { scriObjectHref } from "@/lib/scri/object-links";

export type ImpactRow = {
  id: string;
  objectType: string;
  objectId: string;
  matchType: string;
  matchConfidence: number;
  impactLevel: string | null;
  impactLevelLabel: string | null;
  matchTier: string;
  rationale: string;
};

const TAB_ALL = "ALL";

export function ScriImpactWorkspace({ affected }: { affected: ImpactRow[] }) {
  const types = useMemo(() => {
    const s = new Set<string>();
    for (const a of affected) s.add(a.objectType);
    return [...s].sort();
  }, [affected]);

  const [tab, setTab] = useState<string>(TAB_ALL);

  const filtered =
    tab === TAB_ALL ? affected : affected.filter((a) => a.objectType === tab);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Impact workspace</p>
      <p className="mt-1 text-xs text-zinc-500">
        R2 matches grouped by object class. Tentative rows still need validation.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 border-b border-zinc-100 pb-3">
        <button
          type="button"
          onClick={() => setTab(TAB_ALL)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            tab === TAB_ALL
              ? "bg-[var(--arscmp-primary)] text-white"
              : "border border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          All ({affected.length})
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === t
                ? "bg-[var(--arscmp-primary)] text-white"
                : "border border-zinc-200 bg-zinc-50 text-zinc-700"
            }`}
          >
            {t.replace(/_/g, " ")} ({affected.filter((a) => a.objectType === t).length})
          </button>
        ))}
      </div>
      {filtered.length ? (
        <ul className="mt-3 max-h-72 divide-y divide-zinc-100 overflow-auto text-sm">
          {filtered.map((a) => {
            const href = scriObjectHref(a.objectType, a.objectId);
            return (
              <li key={a.id} className="py-2 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {href ? (
                    <Link href={href} className="font-medium text-amber-800 underline-offset-2 hover:underline">
                      {a.objectType.replace(/_/g, " ")}
                    </Link>
                  ) : (
                    <span className="font-medium text-zinc-800">{a.objectType.replace(/_/g, " ")}</span>
                  )}
                  <span className="text-xs text-zinc-500">
                    {a.matchType.replace(/_/g, " ")} · {a.matchConfidence}%
                    {a.impactLevelLabel ? ` · ${a.impactLevelLabel}` : ""}
                  </span>
                  {a.matchTier === "TENTATIVE" ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                      Tentative
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-zinc-600">{a.rationale}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">No rows in this tab.</p>
      )}
    </section>
  );
}
