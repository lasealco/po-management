"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type AccountRow = {
  id: string;
  name: string;
  accountType: string;
  industry: string | null;
  segment: string | null;
  strategicFlag: boolean;
};

type BriefRow = {
  id: string;
  crmAccountId: string;
  title: string;
  status: string;
  serviceScore: number;
  replyDraft: string;
  approvedReply: string | null;
  operationsSummaryJson: unknown;
  riskSummaryJson: unknown;
  redactionJson: unknown;
  updatedAt: string;
  crmAccount: { name: string };
};

type Snapshot = {
  accounts: AccountRow[];
  briefs: BriefRow[];
};

function readJsonNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "number" ? next : null;
}

function readJsonStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") return [];
  const next = (value as Record<string, unknown>)[key];
  return Array.isArray(next) ? next.filter((item): item is string => typeof item === "string") : [];
}

export function CustomerIntelligenceClient({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [data, setData] = useState(initialSnapshot);
  const [accountId, setAccountId] = useState(initialSnapshot.accounts[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [replyEdits, setReplyEdits] = useState<Record<string, string>>({});

  const selectedAccount = useMemo(() => data.accounts.find((account) => account.id === accountId) ?? null, [accountId, data.accounts]);

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/customer-intelligence", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load customer intelligence."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    setBusy(String(body.briefId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/customer-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update customer intelligence."));
      return;
    }
    setMessage(success);
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">AMP18</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">Customer Intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Build customer-ready service briefs from CRM accounts, sales orders, shipments, delivery promises, invoice-audit
          signals, and open incident rooms. Sensitive finance, margin, supplier, and carrier details are redacted unless
          the viewer is authorized.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Choose account", "Start from CRM account scope."],
            ["Step 2", "Generate brief", "Combine promise, service risk, activity, and evidence."],
            ["Step 3", "Approve reply", "Edit and queue a human-approved customer update."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Account Brief Builder</h3>
          <label className="mt-4 block text-sm font-semibold text-zinc-800" htmlFor="customer-account">
            CRM account
          </label>
          <select
            id="customer-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}{account.strategicFlag ? " · strategic" : ""}
              </option>
            ))}
          </select>
          {selectedAccount ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-950">{selectedAccount.name}</p>
              <p className="mt-1">
                {selectedAccount.accountType} · {selectedAccount.industry ?? "No industry"} · {selectedAccount.segment ?? "No segment"}
              </p>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No active CRM accounts are available.</p>
          )}
          <button
            type="button"
            disabled={!accountId || busy === "create_brief"}
            onClick={() => void post("create_brief", { accountId }, "Customer intelligence brief created.")}
            className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create customer brief
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Accounts</p>
            <p className="mt-1 text-2xl font-semibold">{data.accounts.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Briefs</p>
            <p className="mt-1 text-2xl font-semibold">{data.briefs.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Approved replies</p>
            <p className="mt-1 text-2xl font-semibold">{data.briefs.filter((brief) => brief.status === "REPLY_APPROVED").length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Customer Briefs</h3>
        <div className="mt-4 space-y-4">
          {data.briefs.map((brief) => {
            const promise = brief.operationsSummaryJson && typeof brief.operationsSummaryJson === "object"
              ? (brief.operationsSummaryJson as Record<string, unknown>).promise
              : null;
            const lateShipmentCount = readJsonNumber(promise, "lateShipmentCount");
            const redactions = readJsonStringArray(brief.redactionJson, "categories");
            const reply = replyEdits[brief.id] ?? brief.approvedReply ?? brief.replyDraft;
            return (
              <article key={brief.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {brief.status} · service {brief.serviceScore}/100
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{brief.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Account: {brief.crmAccount.name} · late shipments {lateShipmentCount ?? 0} · updated {new Date(brief.updatedAt).toLocaleString()}
                    </p>
                    {redactions.length > 0 ? <p className="mt-1 text-xs text-amber-700">Redacted: {redactions.join(", ")}</p> : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy === brief.id || !reply.trim()}
                    onClick={() => void post("approve_reply", { briefId: brief.id, approvedReply: reply }, "Customer reply approved and queued for send review.")}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    Approve reply
                  </button>
                </div>
                <textarea
                  value={reply}
                  onChange={(event) => setReplyEdits((current) => ({ ...current, [brief.id]: event.target.value }))}
                  className="mt-3 min-h-64 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.briefs.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No customer intelligence briefs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
