"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { SalesOrderIntentResult } from "@/lib/assistant/sales-order-intent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

const SAMPLE =
  "John from ABC customer called and wants 100 corr-roll for 100 USD a piece. He will send a truck to pick up at our demo warehouse next week tuesday.";

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** set when we need structured clarify */
  result?: SalesOrderIntentResult;
};

export function AssistantMp1Client({ canCreateSalesOrder }: { canCreateSalesOrder: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Describe a customer order in natural language. I’ll match **CRM customers** and **products**, then create a **draft sales order** (with notes) you can open and refine — including line items and shipments when you’re ready.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    text: string;
    result: Extract<SalesOrderIntentResult, { kind: "ready" }> | null;
  } | null>(null);
  const lastUserText = useRef("");

  const runParse = useCallback(
    async (text: string, resAcc: string | null, resProd: string | null) => {
      setBusy(true);
      setErr(null);
      const res = await fetch("/api/assistant/parse-sales-order-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          resolvedAccountId: resAcc || undefined,
          resolvedProductId: resProd || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; result?: SalesOrderIntentResult; error?: string };
      setBusy(false);
      if (!res.ok) {
        setErr(data.error || "Could not parse request.");
        return null;
      }
      return data.result ?? null;
    },
    [],
  );

  const submitText = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    lastUserText.current = text;
    setResolvedAccountId(null);
    setResolvedProductId(null);
    setTurns((t) => [...t, { role: "user", content: text }]);
    setPending(null);

    const r = await runParse(text, null, null);
    if (!r) return;

    if (r.kind === "clarify_account") {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: r.message, result: r },
      ]);
      return;
    }
    if (r.kind === "clarify_product") {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: r.message, result: r },
      ]);
      return;
    }
    if (r.kind === "not_found_account" || r.kind === "not_found_product") {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: r.message },
      ]);
      return;
    }

    if (r.kind === "ready") {
      setTurns((t) => [...t, { role: "assistant", content: r.message }]);
      setPending({ text, result: r });
    }
  };

  const pickAccount = (id: string, label: string) => {
    setResolvedAccountId(id);
    setTurns((turns) => [...turns, { role: "user", content: `Use customer: ${label}` }]);
    void (async () => {
      const t = lastUserText.current;
      if (!t) return;
      const r = await runParse(t, id, resolvedProductId);
      if (!r) return;
      if (r.kind === "clarify_product") {
        setTurns((x) => [...x, { role: "assistant", content: r.message, result: r }]);
        return;
      }
      if (r.kind === "ready") {
        setTurns((x) => [...x, { role: "assistant", content: r.message }]);
        setPending({ text: t, result: r });
        return;
      }
      setTurns((x) => [...x, { role: "assistant", content: r.message }]);
    })();
  };

  const pickProduct = (id: string, label: string) => {
    setResolvedProductId(id);
    setTurns((turns) => [...turns, { role: "user", content: `Use product: ${label}` }]);
    void (async () => {
      const t = lastUserText.current;
      if (!t) return;
      const r = await runParse(t, resolvedAccountId, id);
      if (!r) return;
      if (r.kind === "ready") {
        setTurns((x) => [...x, { role: "assistant", content: r.message }]);
        setPending({ text: t, result: r });
        return;
      }
      if (r.kind === "clarify_account") {
        setTurns((x) => [...x, { role: "assistant", content: r.message, result: r }]);
        return;
      }
      if (r.kind === "clarify_product") {
        setTurns((x) => [...x, { role: "assistant", content: r.message, result: r }]);
        return;
      }
      setTurns((x) => [...x, { role: "assistant", content: r.message }]);
    })();
  };

  const createDraft = async () => {
    if (!canCreateSalesOrder) {
      window.alert("You need org.orders → edit to create a sales order.");
      return;
    }
    if (!pending?.result) return;
    if (
      !window.confirm(
        "Create a new DRAFT sales order in your tenant? (Use Cancel if you were only exploring.)",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    const { createPayload } = pending.result;
    const res = await fetch("/api/sales-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerCrmAccountId: createPayload.customerCrmAccountId,
        requestedDeliveryDate: createPayload.requestedDeliveryDate,
        externalRef: createPayload.externalRef,
        notes: createPayload.notes,
        servedOrgUnitId: createPayload.servedOrgUnitId,
      }),
    });
    const parsed: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(apiClientErrorMessage(parsed, "Could not create sales order."));
      return;
    }
    const id = (parsed as { id?: string }).id;
    if (id) {
      setPending(null);
      setResolvedAccountId(null);
      setResolvedProductId(null);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: "Draft created. Opening the sales order so you can add shipments / lines as needed.",
        },
      ]);
      router.push(`/sales-orders/${id}`);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Conversation</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">Sales assistant (MP1)</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Drafts only — you stay in control. Traces appear in the sales order <strong>notes</strong> and{" "}
          <strong>external ref</strong>.
        </p>
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm text-zinc-800">
          {turns.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2"
                  : "mr-6 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm"
              }
            >
              <p className="text-[10px] font-semibold uppercase text-zinc-500">
                {m.role === "user" ? "You" : "Assistant"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
              {m.result?.kind === "clarify_account" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.result.options.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      onClick={() => pickAccount(a.id, a.name)}
                    >
                      {a.name}
                      {a.legalName ? <span className="block text-[10px] text-zinc-500">{a.legalName}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {m.result?.kind === "clarify_product" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.result.options.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                      onClick={() => pickProduct(p.id, p.name)}
                    >
                      {p.name}
                      {p.productCode ? (
                        <span className="block text-[10px] text-zinc-500">{p.productCode}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {err ? (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-900">{err}</p>
        ) : null}
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-zinc-700" htmlFor="assist-in">
            Your message
          </label>
          <textarea
            id="assist-in"
            className="min-h-[100px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Paste a customer request…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void submitText()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Working…" : "Send to assistant"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setInput(SAMPLE);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              Fill sample scenario
            </button>
            <Link
              href="/sales-orders"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              Sales order list
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Proposed action</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">Summary & evidence</h2>
        <p className="mt-1 text-sm text-zinc-600">
          When a draft is ready, review facts here before opening the record. Add **shipments and line details** on the
          sales order page.
        </p>
        {pending?.result ? (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-zinc-800">
            <p className="font-medium text-emerald-950">Ready to create</p>
            <ul className="list-inside list-disc space-y-1 text-zinc-800">
              <li>
                Customer: <strong>{pending.result.summary.accountName}</strong> (
                <Link
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  href={`/crm/accounts/${pending.result.createPayload.customerCrmAccountId}`}
                >
                  CRM account
                </Link>
                )
              </li>
              <li>
                Product: <strong>{pending.result.summary.productName}</strong> (
                <Link
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  href={`/products/${pending.result.summary.productId}`}
                >
                  product record
                </Link>
                )
              </li>
              <li>Qty: {pending.result.summary.quantity ?? "— (set lines on SO)"}</li>
              <li>Unit price (intent): {pending.result.summary.unitPrice != null ? `${pending.result.summary.unitPrice} USD` : "—"}</li>
              <li>
                Requested delivery:{" "}
                {pending.result.summary.requestedDate
                  ? new Date(pending.result.summary.requestedDate + "T12:00:00").toLocaleDateString()
                  : "—"}
              </li>
              {pending.result.summary.contactName ? <li>Contact: {pending.result.summary.contactName}</li> : null}
              {pending.result.summary.warehouseLabel ? <li>Pickup / warehouse: {pending.result.summary.warehouseLabel}</li> : null}
              {pending.result.summary.servedOrgLabel ? <li>Order for (org): {pending.result.summary.servedOrgLabel}</li> : null}
            </ul>
            <p className="text-xs text-zinc-600">
              External ref and notes on the new SO will include the raw request for audit.
            </p>
            {canCreateSalesOrder ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void createDraft()}
                className="w-full rounded-xl bg-[var(--arscmp-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create draft sales order
              </button>
            ) : (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                View-only: grant <code className="text-[11px]">org.orders → edit</code> to create drafts from here.
              </p>
            )}
            <p className="text-[11px] text-zinc-500">
              A second run will ask you to confirm again so we don’t duplicate orders by accident.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
            No pending draft. Send a message on the left to extract customer, product, and pricing hints.
          </p>
        )}
      </section>
    </div>
  );
}
