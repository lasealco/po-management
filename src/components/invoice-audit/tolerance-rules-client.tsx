"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";

export type SerializedToleranceRule = {
  id: string;
  name: string;
  priority: number;
  active: boolean;
  amountAbsTolerance: string | null;
  percentTolerance: string | null;
  currencyScope: string | null;
};

export function ToleranceRulesClient(props: { canEdit: boolean; initialRules: SerializedToleranceRule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(props.initialRules);
  useEffect(() => {
    setRules(props.initialRules);
  }, [props.initialRules]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("10");
  const [currencyScope, setCurrencyScope] = useState("");
  const [amountAbs, setAmountAbs] = useState("25");
  const [percent, setPercent] = useState("0.015");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setActionError(null);
    try {
      const pv = Number(percent);
      const av = Number(amountAbs);
      const pr = Number.parseInt(priority, 10);
      if (!name.trim()) {
        setActionError("Name is required.");
        return;
      }
      if (!Number.isFinite(pv) || !Number.isFinite(av) || !Number.isFinite(pr)) {
        setActionError("Priority and tolerances must be valid numbers.");
        return;
      }
      const res = await fetch("/api/invoice-audit/tolerance-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          priority: pr,
          amountAbsTolerance: av,
          percentTolerance: pv,
          currencyScope: currencyScope.trim() ? currencyScope.trim().toUpperCase().slice(0, 3) : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
      if (!res.ok) {
        setActionError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleActive(rule: SerializedToleranceRule) {
    setRowBusyId(rule.id);
    try {
      const res = await fetch(`/api/invoice-audit/tolerance-rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
        setActionError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setActionError(null);
      router.refresh();
    } finally {
      setRowBusyId(null);
    }
  }

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  function percentDisplay(ratio: string | null): { pct: string; title: string } | null {
    if (ratio == null || ratio === "") return null;
    const n = Number(ratio);
    if (!Number.isFinite(n)) return { pct: ratio, title: `Ratio ${ratio}` };
    return { pct: `${(n * 100).toFixed(2)}%`, title: `Ratio ${ratio} (multiply by line amount)` };
  }

  return (
    <>
      {actionError && props.canEdit ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {actionError}
        </p>
      ) : null}

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-zinc-600">
        <span className="font-semibold text-zinc-800">How this ties to an intake:</span> changing rules here affects the
        next <span className="font-medium">Run audit</span> only. Finance <span className="font-medium">Approve</span> /{" "}
        <span className="font-medium">Override</span> and <span className="font-medium">Mark ready for accounting</span>{" "}
        stay on the intake closeout panel — configure tolerances when you want stricter or looser amount bands before
        reviewers sign off. Rows sort by <span className="font-medium">priority (highest first)</span> — that is the
        order the engine evaluates when picking a rule for an intake currency.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4" title="Higher number wins when multiple rules match.">
                Priority
              </th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4">Currency scope</th>
              <th className="py-2 pr-4">Abs Δ</th>
              <th className="py-2 pr-4" title="Ratio applied to snapshot vs invoice line amount; shown as percent for readability.">
                Percent
              </th>
              {props.canEdit ? <th className="py-2 pr-4">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={props.canEdit ? 7 : 6} className="py-8 text-zinc-500">
                  No rules yet. Run <code className="rounded bg-zinc-100 px-1">npm run db:seed</code> for the demo
                  default rule, or add one below.
                </td>
              </tr>
            ) : (
              sortedRules.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="max-w-[14rem] py-3 pr-4">
                    <div className="font-medium text-zinc-900">{r.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500" title={r.id}>
                      {r.id}
                    </div>
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-zinc-700">{r.priority}</td>
                  <td className="py-3 pr-4 text-zinc-700">{r.active ? "Yes" : "No"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-600">{r.currencyScope ?? "— (any)"}</td>
                  <td className="py-3 pr-4 tabular-nums text-zinc-700">{r.amountAbsTolerance ?? "—"}</td>
                  <td className="py-3 pr-4 tabular-nums text-zinc-700">
                    {(() => {
                      const pd = percentDisplay(r.percentTolerance);
                      if (!pd) return "—";
                      return (
                        <span className="font-semibold" title={pd.title}>
                          {pd.pct}
                        </span>
                      );
                    })()}
                  </td>
                  {props.canEdit ? (
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        disabled={rowBusyId === r.id}
                        onClick={() => void toggleActive(r)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {rowBusyId === r.id ? "…" : r.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {props.canEdit ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Configuration · New rule</p>
          <h2 className="mt-2 text-sm font-semibold text-zinc-900">Add tolerance rule</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Higher priority wins. Leave currency empty for a global fallback; set a 3-letter code (e.g. USD) to scope
            the rule.
          </p>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submitCreate(e)}>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. USD strict ocean"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Priority</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Currency scope</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm shadow-inner"
                value={currencyScope}
                onChange={(e) => setCurrencyScope(e.target.value)}
                placeholder="Blank = any"
                maxLength={3}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Absolute tolerance</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={amountAbs}
                onChange={(e) => setAmountAbs(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Percent tolerance</label>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                inputMode="decimal"
                placeholder="0.015 = 1.5%"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={createBusy}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
              >
                {createBusy ? "Saving…" : "Create rule"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
