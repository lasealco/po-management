"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { SalesOrderIntentResult } from "@/lib/assistant/sales-order-intent";
import {
  buildGuidedSalesOrderPrompt,
  buildGuidedStockPrompt,
  buildGuidedTracePrompt,
  MODE_CENTER_TITLES,
  MODE_PLACEHOLDERS,
  SAMPLE_DRAFTS_REVIEW,
  SAMPLE_SALES_ORDER,
  SAMPLE_STOCK,
  SAMPLE_TRACE,
  type AssistantWorkbenchMode,
} from "@/lib/assistant/sales-operations-assistant-modes";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ProductOption = { id: string; name: string; productCode: string | null; sku: string | null };

type AnswerOperationsResult =
  | { kind: "defer" }
  | { kind: "no_hint"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "clarify"; message: string; options: ProductOption[] }
  | { kind: "answer"; message: string; evidence: { label: string; href: string }[] };

type AnswerContextResult =
  | { kind: "defer" }
  | { kind: "not_found"; message: string }
  | { kind: "answer"; message: string; evidence: { label: string; href: string }[] };

type Turn = {
  role: "user" | "assistant";
  content: string;
  result?: SalesOrderIntentResult;
  opsClarify?: { message: string; options: ProductOption[] };
  operationsEvidence?: { label: string; href: string }[];
};

export function AssistantMp1Client({
  canCreateSalesOrder,
  assistantMode,
}: {
  canCreateSalesOrder: boolean;
  assistantMode: AssistantWorkbenchMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");
  const shouldRunPrompt = searchParams.get("run") === "1";
  const [input, setInput] = useState(promptParam ?? "");
  const [inputSurface, setInputSurface] = useState<"free" | "guided">("free");
  const [guidedSalesOrder, setGuidedSalesOrder] = useState({
    customer: "",
    deliveryAddress: "",
    productSku: "",
    quantity: "",
    requestedDeliveryDate: "",
    specialInstructions: "",
  });
  const [guidedStock, setGuidedStock] = useState({
    productSku: "",
    customer: "",
    warehouse: "",
    lotBatch: "",
  });
  const [guidedTrace, setGuidedTrace] = useState({
    productSku: "",
    poNumber: "",
    shipmentRef: "",
    lotBatch: "",
    customer: "",
  });

  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Switch modes above anytime. Paste free text or use a guided form — I’ll answer stock/trace with evidence links or prepare a sales order draft for your confirmation.",
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
  const autoRunKeyRef = useRef<string | null>(null);

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
    async (text: string, resolvedProductIdArg: string | undefined) => {
      setBusy(true);
      setErr(null);
      const res = await fetch("/api/assistant/answer-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          resolvedProductId: resolvedProductIdArg || undefined,
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

  const runAnswerContext = useCallback(async (text: string) => {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/assistant/answer-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const raw = (await res.json().catch(() => ({}))) as { error?: string } & Partial<AnswerContextResult>;
    setBusy(false);
    if (!res.ok) {
      setErr(raw.error || "Could not load context answer.");
      return "error" as const;
    }
    if (raw.kind === "defer") return { kind: "defer" } as AnswerContextResult;
    if (raw.kind === "not_found" || raw.kind === "answer") return raw as AnswerContextResult;
    setErr("Invalid response from assistant.");
    return "error" as const;
  }, []);

  const submitPrompt = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      setInput("");
      lastUserText.current = text;
      setResolvedAccountId(null);
      setResolvedProductId(null);
      setTurns((t) => [...t, { role: "user", content: text }]);
      setPending(null);
      setLastOpEvidence(null);

      const contextual = await runAnswerContext(text);
      if (contextual === "error") return;
      if (contextual.kind !== "defer") {
        if (contextual.kind === "not_found") {
          setTurns((t) => [...t, { role: "assistant", content: contextual.message }]);
          return;
        }
        setLastOpEvidence({ message: contextual.message, evidence: contextual.evidence });
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: contextual.message,
            operationsEvidence: contextual.evidence,
          },
        ]);
        return;
      }

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
        setTurns((t) => [...t, { role: "assistant", content: r.message, result: r }]);
        return;
      }
      if (r.kind === "clarify_product") {
        setTurns((t) => [...t, { role: "assistant", content: r.message, result: r }]);
        return;
      }
      if (r.kind === "not_found_account" || r.kind === "not_found_product") {
        setTurns((t) => [...t, { role: "assistant", content: r.message }]);
        return;
      }

      if (r.kind === "ready") {
        setTurns((t) => [...t, { role: "assistant", content: r.message }]);
        setPending({ text, result: r });
      }
    },
    [runAnswerContext, runAnswerOperations, runParse],
  );

  useEffect(() => {
    if (!shouldRunPrompt || !promptParam) return;
    const key = promptParam;
    if (autoRunKeyRef.current === key) return;
    autoRunKeyRef.current = key;
    const timer = window.setTimeout(() => {
      void submitPrompt(promptParam);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [promptParam, shouldRunPrompt, submitPrompt]);

  const submitText = async () => {
    await submitPrompt(input);
  };

  const submitGuided = async () => {
    if (assistantMode === "drafts") return;
    let built = "";
    if (assistantMode === "sales-order") {
      built = buildGuidedSalesOrderPrompt(guidedSalesOrder);
    } else if (assistantMode === "stock") {
      built = buildGuidedStockPrompt(guidedStock);
    } else if (assistantMode === "trace") {
      built = buildGuidedTracePrompt(guidedTrace);
    }
    const t = built.trim();
    if (t.length < 12) {
      setErr("Fill at least one guided field before analyzing.");
      return;
    }
    setErr(null);
    await submitPrompt(t);
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
        assistantSourceText: createPayload.assistantSourceText,
        assistantSourceSnapshot: createPayload.assistantSourceSnapshot,
        assistantDraftReply: createPayload.assistantDraftReply,
        lines: createPayload.lines,
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
          content: "Draft created with structured line details and an assistant reply draft. Opening the sales order now.",
        },
      ]);
      router.push(`/sales-orders/${id}`);
    }
  };

  const discardPending = () => {
    if (!pending?.result) return;
    if (!window.confirm("Discard this proposed draft from the review panel?")) return;
    setPending(null);
  };

  const editPendingIntoInput = () => {
    if (!pending?.result) return;
    setInput(pending.text);
    setPending(null);
  };

  function fillSampleOrder() {
    setInput(SAMPLE_SALES_ORDER);
  }

  function fillStockTraceSample() {
    if (assistantMode === "trace") setInput(SAMPLE_TRACE);
    else setInput(SAMPLE_STOCK);
  }

  function fillDraftsSample() {
    setInput(SAMPLE_DRAFTS_REVIEW);
  }

  const centerTitle = MODE_CENTER_TITLES[assistantMode];
  const placeholder = MODE_PLACEHOLDERS[assistantMode];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Assistant</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">{centerTitle}</h2>

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
              <p className="text-[10px] font-semibold uppercase text-zinc-500">{m.role === "user" ? "You" : "Assistant"}</p>
              <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
              {m.operationsEvidence && m.operationsEvidence.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                  {m.operationsEvidence.map((e) => (
                    <li key={e.label + e.href}>
                      <Link className="font-medium text-[var(--arscmp-primary)] hover:underline" href={e.href}>
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
                      {p.productCode ? <span className="block text-[10px] text-zinc-500">{p.productCode}</span> : null}
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
                      {p.productCode ? <span className="block text-[10px] text-amber-800/80">{p.productCode}</span> : null}
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

        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInputSurface("free")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                inputSurface === "free"
                  ? "bg-[var(--arscmp-primary)] text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Free text
            </button>
            <button
              type="button"
              onClick={() => setInputSurface("guided")}
              disabled={assistantMode === "drafts"}
              title={assistantMode === "drafts" ? "Guided form is available for order, stock, and trace modes." : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                inputSurface === "guided"
                  ? "bg-[var(--arscmp-primary)] text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Guided form
            </button>
          </div>

          {inputSurface === "guided" && assistantMode !== "drafts" ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm">
              {assistantMode === "sales-order" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Customer</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.customer}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, customer: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Product / SKU</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.productSku}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, productSku: e.target.value }))}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Delivery address</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.deliveryAddress}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, deliveryAddress: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Quantity</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.quantity}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, quantity: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Requested delivery date</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.requestedDeliveryDate}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, requestedDeliveryDate: e.target.value }))}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Special instructions</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedSalesOrder.specialInstructions}
                      onChange={(e) => setGuidedSalesOrder((s) => ({ ...s, specialInstructions: e.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
              {assistantMode === "stock" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Product / SKU</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedStock.productSku}
                      onChange={(e) => setGuidedStock((s) => ({ ...s, productSku: e.target.value }))}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Customer</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedStock.customer}
                      onChange={(e) => setGuidedStock((s) => ({ ...s, customer: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Warehouse</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedStock.warehouse}
                      onChange={(e) => setGuidedStock((s) => ({ ...s, warehouse: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Lot / batch</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedStock.lotBatch}
                      onChange={(e) => setGuidedStock((s) => ({ ...s, lotBatch: e.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
              {assistantMode === "trace" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Product / SKU</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedTrace.productSku}
                      onChange={(e) => setGuidedTrace((s) => ({ ...s, productSku: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">PO number</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedTrace.poNumber}
                      onChange={(e) => setGuidedTrace((s) => ({ ...s, poNumber: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Shipment reference</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedTrace.shipmentRef}
                      onChange={(e) => setGuidedTrace((s) => ({ ...s, shipmentRef: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium text-zinc-600">Lot / batch</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedTrace.lotBatch}
                      onChange={(e) => setGuidedTrace((s) => ({ ...s, lotBatch: e.target.value }))}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-medium text-zinc-600">Customer</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                      value={guidedTrace.customer}
                      onChange={(e) => setGuidedTrace((s) => ({ ...s, customer: e.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitGuided()}
                className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Analyze request
              </button>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-zinc-700" htmlFor="assist-in">
                Your message
              </label>
              <textarea
                id="assist-in"
                className="min-h-[100px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
              />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {inputSurface === "free" ? (
              <button
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void submitText()}
                className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Working…" : "Analyze request"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || assistantMode !== "sales-order"}
              onClick={fillSampleOrder}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              Use sample order
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (assistantMode === "drafts") fillDraftsSample();
                else fillStockTraceSample();
              }}
              className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 hover:bg-amber-100"
            >
              Check stock / trace product
            </button>
            <Link
              href="/sales-orders"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              Open sales orders
            </Link>
          </div>
          {inputSurface === "free" ? (
            <p className="text-[11px] text-zinc-500">
              Drafts only become records when you confirm. Stock and trace answers link to existing tenant data when grants allow.
            </p>
          ) : null}
        </div>
      </section>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm xl:min-h-[420px]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Action Review</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">Action Review</h2>

        {!pending?.result && !lastOpEvidence ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            No active draft yet. Results, evidence, missing fields, and confirmation actions will appear here after analysis.
          </p>
        ) : null}

        {lastOpEvidence && !pending?.result ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-800">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Proposed action</p>
              <p className="mt-1 font-medium text-zinc-900">
                {assistantMode === "trace"
                  ? "Trace product movement"
                  : assistantMode === "stock"
                    ? "Check stock"
                    : assistantMode === "drafts"
                      ? "Review / operations insight"
                      : "Operations insight"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Query</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600">{lastUserText.current || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Result summary</p>
              <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-xs text-zinc-700">{lastOpEvidence.message}</p>
            </div>
            {lastOpEvidence.evidence.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Evidence links</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {lastOpEvidence.evidence.map((e) => (
                    <li key={e.label + e.href}>
                      <Link className="font-medium text-[var(--arscmp-primary)] hover:underline" href={e.href}>
                        {e.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {pending?.result ? (
          <div className="mt-4 space-y-3 text-sm text-zinc-800">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Proposed action</p>
              <p className="mt-1 font-medium text-zinc-900">Create sales order draft</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</p>
              <p className="mt-1 text-xs text-zinc-700">Ready for confirmation</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Customer</p>
              <p className="mt-1 font-medium">{pending.result.summary.accountName}</p>
              <Link
                className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                href={`/crm/accounts/${pending.result.createPayload.customerCrmAccountId}`}
              >
                Open CRM account
              </Link>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Products</p>
              <p className="mt-1 font-medium">{pending.result.summary.productName}</p>
              <Link
                className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                href={`/products/${pending.result.summary.productId}`}
              >
                Open product record
              </Link>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Delivery address</p>
              <p className="mt-1 text-xs text-zinc-600">
                {pending.result.summary.warehouseLabel ?? pending.result.summary.servedOrgLabel ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Missing fields</p>
              <p className="mt-1 text-xs text-zinc-600">
                {pending.result.summary.quantity == null ||
                pending.result.summary.unitPrice == null ||
                !pending.result.summary.requestedDate
                  ? "Quantity, unit price, or requested delivery may need confirmation in the editor after draft creation."
                  : "Core fields present — still verify in the draft detail screen."}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Evidence</p>
              <p className="mt-1 text-xs text-zinc-600">Structured payload and assistant snapshot are stored on create.</p>
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
              {canCreateSalesOrder ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createDraft()}
                  className="w-full rounded-xl bg-[var(--arscmp-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Create draft
                </button>
              ) : (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Draft creation requires <code className="text-[11px]">org.orders → edit</code>.
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={editPendingIntoInput}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Edit request
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={discardPending}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-900 hover:bg-red-100"
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
