"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function QuoteLineListTierEditor({
  lineId,
  initialList,
  initialTier,
  currency,
  busy,
  onSave,
}: {
  lineId: string;
  initialList: string | null;
  initialTier: string | null;
  currency: string;
  busy: boolean;
  onSave: (lineId: string, listRaw: string, tierRaw: string) => void;
}) {
  const [list, setList] = useState(initialList ?? "");
  const [tier, setTier] = useState(initialTier ?? "");

  return (
    <div className="flex max-w-[15rem] flex-col gap-1">
      <input
        value={list}
        onChange={(e) => setList(e.target.value)}
        placeholder={`List unit (${currency})`}
        disabled={busy}
        className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-900"
      />
      <input
        value={tier}
        onChange={(e) => setTier(e.target.value)}
        placeholder="Tier / contract label"
        disabled={busy}
        maxLength={64}
        className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-900"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(lineId, list, tier)}
        className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-900 disabled:opacity-50"
      >
        Save terms
      </button>
    </div>
  );
}

function QuoteLineSkuEditor({
  lineId,
  initialSku,
  busy,
  onSave,
}: {
  lineId: string;
  initialSku: string | null;
  busy: boolean;
  onSave: (lineId: string, sku: string) => void;
}) {
  const [val, setVal] = useState(initialSku ?? "");

  return (
    <div className="flex max-w-[11rem] flex-col gap-1 sm:flex-row sm:items-center">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Product.sku"
        disabled={busy}
        className="w-full rounded-lg border border-zinc-200 px-2 py-1 font-mono text-xs text-zinc-900"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(lineId, val)}
        className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-900 disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}

type Line = {
  id: string;
  sortOrder: number;
  description: string;
  inventorySku: string | null;
  quantity: string;
  unitPrice: string;
  /** BF-22 — optional catalog/list unit for contracted-vs-list deltas on explosion. */
  listUnitPrice: string | null;
  priceTierLabel: string | null;
  extendedAmount: string | null;
};

type Quote = {
  id: string;
  title: string;
  status: string;
  quoteNumber: string | null;
  validUntil: string | null;
  currency: string;
  notes: string | null;
  subtotal: string | null;
  ownerUserId: string;
  account: { id: string; name: string };
  opportunity: { id: string; name: string } | null;
  lines: Line[];
};

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export function CrmQuoteDetail({
  quoteId,
  actorUserId,
  canEditAll,
}: {
  quoteId: string;
  actorUserId: string;
  canEditAll: boolean;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [notes, setNotes] = useState("");

  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [lineSku, setLineSku] = useState("");
  const [lineList, setLineList] = useState("");
  const [lineTier, setLineTier] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}`);
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Load failed"));
      const q = (data as { quote: Quote }).quote;
      setQuote(q);
      setTitle(q.title);
      setStatus(q.status);
      setNotes(q.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), status, notes: notes.trim() || null }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Save failed"));
      setQuote((data as { quote: Quote }).quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLine(ev: React.FormEvent) {
    ev.preventDefault();
    if (!desc.trim() || !price.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        description: desc.trim(),
        quantity: qty,
        unitPrice: price,
        inventorySku: lineSku.trim() ? lineSku.trim() : null,
      };
      const listTrim = lineList.trim();
      if (listTrim) {
        const n = Number(listTrim);
        if (Number.isNaN(n) || n <= 0) {
          setError("List unit price must be a positive number.");
          setBusy(false);
          return;
        }
        payload.listUnitPrice = n;
      }
      const tierTrim = lineTier.trim().slice(0, 64);
      if (tierTrim) payload.priceTierLabel = tierTrim;

      const res = await fetch(`/api/crm/quotes/${quoteId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Save failed"));
      setDesc("");
      setQty("1");
      setPrice("");
      setLineSku("");
      setLineList("");
      setLineTier("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLineListTier(lineId: string, listRaw: string, tierRaw: string) {
    setBusy(true);
    setError(null);
    try {
      const listTrim = listRaw.trim();
      const tierTrim = tierRaw.trim().slice(0, 64);
      const body: Record<string, unknown> = {
        priceTierLabel: tierTrim ? tierTrim : null,
      };
      if (!listTrim) {
        body.listUnitPrice = null;
      } else {
        const n = Number(listTrim);
        if (Number.isNaN(n) || n <= 0) {
          setError("List unit price must be a positive number.");
          setBusy(false);
          return;
        }
        body.listUnitPrice = n;
      }
      const res = await fetch(`/api/crm/quotes/${quoteId}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Save failed"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLineInventorySku(lineId: string, sku: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventorySku: sku.trim() ? sku.trim().slice(0, 128) : null,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Save failed"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(lineId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}/lines/${lineId}`, {
        method: "DELETE",
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Delete failed"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !quote) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm" role="alert">
          <p className="text-sm font-medium text-red-900">Could not load quote</p>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
        <Link href="/crm/quotes" className="mt-6 inline-block text-sm font-medium text-violet-700 hover:underline">
          ← Quotes
        </Link>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="mx-auto mb-3 h-8 w-56 animate-pulse rounded-lg bg-zinc-100" />
        <div className="mx-auto h-4 w-72 animate-pulse rounded bg-zinc-50" />
        <p className="mt-4 text-sm text-zinc-500">Loading quote…</p>
      </div>
    );
  }

  const canPatch = canEditAll || quote.ownerUserId === actorUserId;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/crm/quotes" className="text-sm font-medium text-violet-700 hover:underline">
          ← Quotes
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold text-zinc-900">{quote.title}</h1>
        {quote.quoteNumber ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
            {quote.quoteNumber}
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-zinc-600">
        Account:{" "}
        <Link href={`/crm/accounts/${quote.account.id}`} className="text-violet-700 hover:underline">
          {quote.account.name}
        </Link>
        {quote.opportunity ? (
          <>
            {" · "}
            <Link
              href={`/crm/opportunities/${quote.opportunity.id}`}
              className="text-violet-700 hover:underline"
            >
              {quote.opportunity.name}
            </Link>
          </>
        ) : null}
      </p>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Warehouse fulfillment</p>
        <p className="mt-2 text-sm text-zinc-700">
          Jump to WMS Operations with this quote and bill-to account prefilled for outbound creation (BF-10 quote
          lineage). Set each line&apos;s <span className="font-medium text-zinc-900">WMS SKU</span> to match{" "}
          <span className="font-medium text-zinc-900">Product.sku</span> before exploding lines on the outbound (BF-14).
          Optional <span className="font-medium text-zinc-900">list unit</span> and{" "}
          <span className="font-medium text-zinc-900">tier label</span> drive contracted-vs-list deltas in Operations preview
          (BF-22).
        </p>
        <Link
          href={`/wms/operations?quoteId=${encodeURIComponent(quote.id)}&crmAccountId=${encodeURIComponent(quote.account.id)}`}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Open WMS outbound handoff
        </Link>
      </section>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
          {error}
        </div>
      ) : null}

      {canPatch ? (
        <form onSubmit={saveHeader} className="mb-8 space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="text-zinc-600">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Save header
          </button>
        </form>
      ) : (
        <p className="mb-8 text-sm text-zinc-600">Read-only for this user.</p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Line items</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Loaded with the quote from{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">GET /api/crm/quotes/[id]</code>{" "}
              (includes lines).
            </p>
          </div>
          <p className="text-sm text-zinc-600">
            Subtotal:{" "}
            <span className="font-medium text-zinc-900">
              {quote.subtotal != null ? `${quote.subtotal} ${quote.currency}` : "—"}
            </span>
          </p>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-100">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">WMS SKU</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">Line total</th>
                <th className="px-3 py-2">List · tier (BF-22)</th>
                {canPatch ? <th className="px-3 py-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {quote.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={canPatch ? 7 : 6}
                    className="px-3 py-10 text-center text-sm text-zinc-500"
                  >
                    No line items on this quote yet.
                  </td>
                </tr>
              ) : (
                [...quote.lines]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((l) => (
                    <tr key={l.id} className="border-b border-zinc-50 last:border-0">
                      <td className="max-w-xs px-3 py-2 font-medium text-zinc-900">{l.description}</td>
                      <td className="px-3 py-2 align-top">
                        {canPatch ? (
                          <QuoteLineSkuEditor
                            key={`${l.id}-sku-${l.inventorySku ?? ""}`}
                            lineId={l.id}
                            initialSku={l.inventorySku}
                            busy={busy}
                            onSave={saveLineInventorySku}
                          />
                        ) : (
                          <span className="font-mono text-xs text-zinc-700">{l.inventorySku ?? "—"}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                        {l.quantity}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-700">
                        {l.unitPrice} {quote.currency}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-900">
                        {l.extendedAmount != null ? `${l.extendedAmount} ${quote.currency}` : "—"}
                      </td>
                      <td className="min-w-[9rem] px-3 py-2 align-top text-xs text-zinc-700">
                        {canPatch ? (
                          <QuoteLineListTierEditor
                            key={`${l.id}-lt-${l.listUnitPrice ?? ""}-${l.priceTierLabel ?? ""}`}
                            lineId={l.id}
                            initialList={l.listUnitPrice}
                            initialTier={l.priceTierLabel}
                            currency={quote.currency}
                            busy={busy}
                            onSave={saveLineListTier}
                          />
                        ) : (
                          <span>
                            {l.listUnitPrice != null ? `${l.listUnitPrice} ${quote.currency}` : "—"}
                            {l.priceTierLabel ? (
                              <span className="block text-zinc-500">{l.priceTierLabel}</span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      {canPatch ? (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeLine(l.id)}
                            className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {canPatch ? (
          <div id="crm-quote-add-line" className="mt-6 border-t border-zinc-100 pt-5">
            <h3 className="text-sm font-semibold text-zinc-900">Add a line</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Inline add uses{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">POST /api/crm/quotes/[id]/lines</code>
              . Deep link:{" "}
              <Link
                href={`/crm/quotes/${quoteId}#crm-quote-add-line`}
                className="font-medium text-violet-800 hover:underline"
              >
                #crm-quote-add-line
              </Link>
              .
            </p>
            <form onSubmit={addLine} className="mt-4 grid gap-2 sm:grid-cols-6">
              <input
                placeholder="Description"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-2"
                disabled={busy}
              />
              <input
                placeholder="WMS SKU (optional)"
                value={lineSku}
                onChange={(e) => setLineSku(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                disabled={busy}
                title="Matches tenant Product.sku for BF-14 outbound explosion"
              />
              <input
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="Contract unit price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="List unit (optional · BF-22)"
                value={lineList}
                onChange={(e) => setLineList(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-3"
                disabled={busy}
              />
              <input
                placeholder="Tier label (optional)"
                value={lineTier}
                onChange={(e) => setLineTier(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-3"
                disabled={busy}
                maxLength={64}
              />
              <button
                type="submit"
                disabled={busy || !desc.trim() || !price.trim()}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 sm:col-span-6"
              >
                Add line
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-600">
            Adding or editing lines requires quote owner (or CRM edit-all) access. Use{" "}
            <Link href="/settings/demo" className="font-medium text-violet-800 hover:underline">
              Settings → Demo session
            </Link>{" "}
            to act as the owner, or ask an admin for the org CRM edit grant.
          </p>
        )}
      </section>
    </div>
  );
}
