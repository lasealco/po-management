"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Line = {
  id: string;
  sortOrder: number;
  description: string;
  quantity: string;
  unitPrice: string;
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      const q = data.quote as Quote;
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setQuote(data.quote);
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
      const res = await fetch(`/api/crm/quotes/${quoteId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: desc.trim(),
          quantity: qty,
          unitPrice: price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDesc("");
      setQty("1");
      setPrice("");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
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
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/crm/quotes" className="mt-4 inline-block text-sm text-violet-700">
          ← Quotes
        </Link>
      </div>
    );
  }

  if (!quote) {
    return <div className="px-6 py-16 text-sm text-zinc-500">Loading…</div>;
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

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Line items</h2>
          <p className="text-sm text-zinc-600">
            Subtotal:{" "}
            <span className="font-medium text-zinc-900">
              {quote.subtotal != null ? `${quote.subtotal} ${quote.currency}` : "—"}
            </span>
          </p>
        </div>
        {canPatch ? (
          <form onSubmit={addLine} className="mt-4 grid gap-2 border-b border-zinc-100 pb-4 sm:grid-cols-4">
            <input
              placeholder="Description"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-2"
              disabled={busy}
            />
            <input
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
            <input
              placeholder="Unit price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !desc.trim() || !price.trim()}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 sm:col-span-4"
            >
              Add line
            </button>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {quote.lines.length === 0 ? (
            <li className="py-4 text-zinc-500">No lines yet.</li>
          ) : (
            quote.lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className="font-medium text-zinc-900">{l.description}</div>
                  <div className="text-xs text-zinc-500">
                    {l.quantity} × {l.unitPrice} = {l.extendedAmount ?? "—"}
                  </div>
                </div>
                {canPatch ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeLine(l.id)}
                    className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
