"use client";

import { useTwinCachedAsync } from "@/components/supply-chain-twin/use-twin-cached-async";
import { twinApiClientErrorMessage } from "@/lib/supply-chain-twin/error-codes";

type CatalogRow = { ref: { kind: string; id: string } };

type CatalogResult =
  | { ok: true; items: CatalogRow[] }
  | { ok: false; message: string };

async function fetchCatalog(): Promise<CatalogResult> {
  try {
    const res = await fetch("/api/supply-chain-twin/entities?q=", { cache: "no-store" });
    const body = (await res.json()) as unknown;
    if (!res.ok) {
      return { ok: false, message: twinApiClientErrorMessage(body, `Request failed (${res.status})`) };
    }
    if (
      typeof body !== "object" ||
      body == null ||
      !("items" in body) ||
      !Array.isArray((body as { items: unknown }).items)
    ) {
      return { ok: false, message: "Unexpected response from entity catalog." };
    }
    const items = (body as { items: unknown[] }).items;
    const normalized: CatalogRow[] = [];
    for (const row of items) {
      if (
        typeof row === "object" &&
        row != null &&
        "ref" in row &&
        typeof (row as { ref: unknown }).ref === "object" &&
        (row as { ref: unknown }).ref != null &&
        "kind" in (row as { ref: { kind?: unknown } }).ref &&
        "id" in (row as { ref: { id?: unknown } }).ref &&
        typeof (row as { ref: { kind: unknown } }).ref.kind === "string" &&
        typeof (row as { ref: { id: unknown } }).ref.id === "string"
      ) {
        normalized.push({
          ref: {
            kind: (row as { ref: { kind: string } }).ref.kind,
            id: (row as { ref: { id: string } }).ref.id,
          },
        });
      }
    }
    if (normalized.length !== items.length) {
      return { ok: false, message: "Unexpected response from entity catalog." };
    }
    return { ok: true, items: normalized };
  } catch {
    return { ok: false, message: "Network error while loading the catalog." };
  }
}

function TwinEntitiesSectionInner() {
  const snapshot = useTwinCachedAsync("sctwin:entities:catalog-home:v1", () => fetchCatalog());

  if (snapshot.status === "pending") {
    return <p className="mt-4 text-sm text-zinc-500">Loading catalog…</p>;
  }

  if (snapshot.status === "rejected") {
    return (
      <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Network error while loading the catalog.
      </p>
    );
  }

  const result = snapshot.data;

  return (
    <>
      {result.ok === false ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{result.message}</p>
      ) : null}

      {result.ok && result.items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">No entities yet</p>
          <p className="mt-1">The catalog API is wired; seed data and graph snapshots will populate this list.</p>
        </div>
      ) : null}

      {result.ok && result.items.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 text-sm text-zinc-800">
          {result.items.map((row) => (
            <li key={`${row.ref.kind}:${row.ref.id}`} className="px-4 py-3">
              <span className="font-mono text-xs text-zinc-500">{row.ref.kind}</span>{" "}
              <span className="text-zinc-900">{row.ref.id}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function TwinEntitiesSection() {
  return (
    <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Twin entity catalog</h2>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">GET /api/supply-chain-twin/entities</p>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Live list from the twin API (stub). When graph persistence lands, matching entities appear here.
      </p>

      <TwinEntitiesSectionInner />
    </section>
  );
}
