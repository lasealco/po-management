"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { SalesOrderIntentResult } from "@/lib/assistant/sales-order-intent";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const SAMPLE =
  "John from ABC customer called and wants 100 corr-roll for 100 USD a piece. He will send a truck to pick up at our demo warehouse next week tuesday.";

const SAMPLE_STOCK = "How much corr-roll do we have in stock at the demo warehouse?";

type ProductOption = { id: string; name: string; productCode: string | null; sku: string | null };

type AnswerOperationsResult =
  | { kind: "defer" }
  | { kind: "no_hint"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "clarify"; message: string; options: ProductOption[] }
  | { kind: "answer"; message: string; evidence: { label: string; href: string }[] };

type Turn = {
  role: "user" | "assistant";
  content: string;
  /** set when we need structured clarify */
  result?: SalesOrderIntentResult;
  /** MP3: product disambiguation for stock / trace (not a sales draft) */
  opsClarify?: { message: string; options: ProductOption[] };
  /** MP3: answer with deep links to evidence */
  operationsEvidence?: { label: string; href: string }[];
};

export function AssistantMp1Client({ canCreateSalesOrder }: { canCreateSalesOrder: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");
  const [input, setInput] = useState(promptParam ?? "");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Describe a customer order in natural language, or ask about **stock / where product is** (e.g. “How much corr-roll is in stock?”). I match CRM and products, then either create a **draft sales order** or return **on-hand, shipments, and PO** evidence with links — no auto commits beyond drafts you confirm.",
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
  const [lastOpEvidence, setLastOpEvidence] = useState<{
    message: string;
    evidence: { label: string; href: string }[];
  } | null>(null);
  const lastUserText = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (promptParam) setInput(promptParam);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [promptParam]);

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

  const runAnswerOperations = useCallback(
    async (text: string, resolvedProductId: string | undefined) => {
      setBusy(true);
      setErr(null);
      const res = await fetch("/api/assistant/answer-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          resolvedProductId: resolvedProductId || undefined,
        }),
      });
      const raw = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AnswerOperationsResult>;
      setBusy(false);
      if (!res.ok) {
        setErr(raw.error || "Could not load operations answer.");
        return "error" as const;
      }
      if (raw.kind === "defer") return "defer" as const;
      if (
        raw.kind === "no_hint" ||
        raw.kind === "not_found" ||
        raw.kind === "clarify" ||
        raw.kind === "answer"
      ) {
        return raw as AnswerOperationsResult;
      }
      setErr("Invalid response from assistant.");
      return "error" as const;
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
    setLastOpEvidence(null);

    const op = await runAnswerOperations(text, undefined);
    if (op === "error") return;
    if (op && op !== "defer") {
      if (op.kind === "no_hint") {
        setTurns((t) => [...t, { role: "assistant", content: op.message }]);
        return;
      }
      if (op.kind === "not_found") {
        setTurns((t) => [...t, { role: "assistant", content: op.message }]);
        return;
      }
      if (op.kind === "clarify") {
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: op.message,
            opsClarify: { message: op.message, options: op.options },
          },
        ]);
        return;
      }
      if (op.kind === "answer") {
        setLastOpEvidence({ message: op.message, evidence: op.evidence });
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: op.message,
            operationsEvidence: op.evidence,
          },
        ]);
        return;
      }
    }

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

  const pickProductForOps = (id: string, label: string) => {
    setTurns((turns) => [...turns, { role: "user", content: `Use product: ${label}` }]);
    void (async () => {
      const t = lastUserText.current;
      if (!t) return;
      const op = await runAnswerOperations(t, id);
      if (op === "error" || !op || op === "defer") return;
      if (op.kind === "not_found" || op.kind === "no_hint") {
        setTurns((x) => [...x, { role: "assistant", content: op.message }]);
        return;
      }
      if (op.kind === "clarify") {
        setTurns((x) => [
          ...x,
          {
            role: "assistant",
            content: op.message,
            opsClarify: { message: op.message, options: op.options },
          },
        ]);
        return;
      }
      if (op.kind === "answer") {
        setLastOpEvidence({ message: op.message, evidence: op.evidence });
        setTurns((x) => [
          ...x,
          {
            role: "assistant",
            content: op.message,
            operationsEvidence: op.evidence,
          },
        ]);
      }
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
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">Sales & operations (MP1 + MP3)</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Drafts only for SO creation. For inventory questions, answers include links to <strong>product</strong>,{" "}
          <strong>product trace</strong>, <strong>shipments</strong>, and <strong>POs</strong> (when data exists in your
          tenant and grants allow).
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
              {m.operationsEvidence && m.operationsEvidence.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  {m.operationsEvidence.map((e) => (
                    <li key={e.label + e.href}>
                      <Link
                        className="font-medium text-[var(--arscmp-primary)] hover:underline"
                        href={e.href}
                      >
                        {e.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
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
              {m.opsClarify ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.opsClarify.options.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="rounded-lg border border-amber-300 bg-amber-50/80 px-2.5 py-1.5 text-left text-xs font-medium text-amber-950 hover:bg-amber-100"
                      onClick={() => pickProductForOps(p.id, p.name)}
                    >
                      {p.name}
                      {p.sku ? <span className="block text-[10px] text-amber-800/90">{p.sku}</span> : null}
                      {p.productCode ? (
                        <span className="block text-[10px] text-amber-800/80">{p.productCode}</span>
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
            placeholder="Customer order, or e.g. “How much corr-roll is in stock?”"
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
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setInput(SAMPLE_STOCK);
              }}
              className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 hover:bg-amber-100"
            >
              Try stock / trace
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
          When a draft is ready, review here before creating the record. For inventory / trace questions, the same
          evidence appears in the thread with links to product trace, WMS, and shipments.
        </p>
        {lastOpEvidence ? (
          <div className="mt-4 space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-sm text-zinc-800">
            <p className="font-medium text-sky-950">Last operations answer (MP3)</p>
            <p className="line-clamp-4 whitespace-pre-wrap text-xs text-zinc-600">{lastOpEvidence.message}</p>
            <ul className="space-y-1 text-xs">
              {lastOpEvidence.evidence.map((e) => (
                <li key={e.label + e.href}>
                  <Link
                    className="font-medium text-[var(--arscmp-primary)] hover:underline"
                    href={e.href}
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
        ) : !lastOpEvidence ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
            No pending draft. Ask for stock or trace, or send a customer order to extract a draft.
          </p>
        ) : null}
      </section>
    </div>
  );
}
