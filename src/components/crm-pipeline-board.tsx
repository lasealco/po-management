"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const STAGES = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
] as const;

type Opp = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  closeDate: string | null;
  account: { id: string; name: string };
};

export function CrmPipelineBoard() {
  const searchParams = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opp[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/opportunities");
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Failed to load"));
      setOpportunities((data as { opportunities?: Opp[] }).opportunities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stageFilterRaw = (searchParams.get("stage") || "").toUpperCase();
  const stageFilter = STAGES.includes(stageFilterRaw as (typeof STAGES)[number]) ? stageFilterRaw : "";
  const focus = (searchParams.get("focus") || "").toLowerCase();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const filteredOpps = useMemo(() => {
    return opportunities.filter((o) => {
      if (stageFilter && o.stage !== stageFilter) return false;
      if (focus === "stale") {
        if (!o.closeDate) return false;
        return new Date(o.closeDate) < today;
      }
      return true;
    });
  }, [focus, opportunities, stageFilter, today]);

  const byStage = useMemo(() => {
    const m = new Map<string, Opp[]>();
    for (const s of STAGES) m.set(s, []);
    for (const o of filteredOpps) {
      const list = m.get(o.stage) ?? [];
      list.push(o);
      m.set(o.stage, list);
    }
    return m;
  }, [filteredOpps]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Pipeline</h1>
          <p className="text-sm text-zinc-600">
            Opportunities by stage (read-only board). Open a card to edit fields and stage.
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
      {(stageFilter || focus === "stale") ? (
        <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Filtered view:{" "}
          {stageFilter ? <span className="font-semibold">stage={stageFilter}</span> : null}
          {stageFilter && focus === "stale" ? " · " : null}
          {focus === "stale" ? <span className="font-semibold">stale opportunities</span> : null}
          {" · "}
          <Link href="/crm/pipeline" className="underline">
            clear
          </Link>
        </div>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="w-56 shrink-0 rounded-xl border border-zinc-200 bg-zinc-100/80 p-2"
          >
            <h2 className="border-b border-zinc-200 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              {stage.replace(/_/g, " ")}
            </h2>
            <ul className="mt-2 space-y-2">
              {(byStage.get(stage) ?? []).map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/crm/opportunities/${o.id}`}
                    className="block rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-sm transition hover:border-violet-300 hover:shadow"
                  >
                    <span className="font-medium text-zinc-900">{o.name}</span>
                    <div className="mt-1 text-xs text-zinc-500">{o.account.name}</div>
                    <div className="mt-1 text-xs text-violet-700">{o.probability}%</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
