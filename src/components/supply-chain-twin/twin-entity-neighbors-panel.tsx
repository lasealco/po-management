"use client";

import { twinApiClientErrorMessage } from "@/lib/supply-chain-twin/error-codes";
import Link from "next/link";
import { TwinFallbackState } from "./twin-fallback-state";
import { useTwinCachedAsync } from "./use-twin-cached-async";

type NeighborRow = {
  edgeId: string;
  relation: string | null;
  direction: "in" | "out";
  snapshotId: string;
  ref: { kind: string; id: string };
};

type NeighborsResult = { ok: true; rows: NeighborRow[] } | { ok: false; message: string };

async function fetchEntityNeighbors(snapshotId: string): Promise<NeighborsResult> {
  try {
    const params = new URLSearchParams();
    params.set("direction", "both");
    params.set("take", "100");
    const res = await fetch(
      `/api/supply-chain-twin/entities/${encodeURIComponent(snapshotId)}/neighbors?${params.toString()}`,
      { cache: "no-store" },
    );
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 404) {
        return { ok: false, message: "This snapshot is no longer available for neighbor lookup." };
      }
      if (res.status === 403) {
        return { ok: false, message: "This workspace session cannot access twin neighbors right now." };
      }
      return { ok: false, message: twinApiClientErrorMessage(body, "Neighbor data could not be loaded right now.") };
    }
    if (typeof body !== "object" || body == null || !("neighbors" in body) || !Array.isArray((body as { neighbors: unknown }).neighbors)) {
      return { ok: false, message: "Unexpected neighbors response from twin API." };
    }
    const rawRows = (body as { neighbors: unknown[] }).neighbors;
    const rows: NeighborRow[] = [];
    for (const row of rawRows) {
      if (
        typeof row === "object" &&
        row != null &&
        "edgeId" in row &&
        typeof (row as { edgeId: unknown }).edgeId === "string" &&
        "relation" in row &&
        ((row as { relation: unknown }).relation === null || typeof (row as { relation: unknown }).relation === "string") &&
        "direction" in row &&
        ((row as { direction: unknown }).direction === "in" || (row as { direction: unknown }).direction === "out") &&
        "snapshotId" in row &&
        typeof (row as { snapshotId: unknown }).snapshotId === "string" &&
        "ref" in row &&
        typeof (row as { ref: unknown }).ref === "object" &&
        (row as { ref: unknown }).ref != null &&
        "kind" in (row as { ref: { kind?: unknown } }).ref &&
        "id" in (row as { ref: { id?: unknown } }).ref &&
        typeof (row as { ref: { kind: unknown } }).ref.kind === "string" &&
        typeof (row as { ref: { id: unknown } }).ref.id === "string"
      ) {
        rows.push({
          edgeId: (row as { edgeId: string }).edgeId,
          relation: (row as { relation: string | null }).relation,
          direction: (row as { direction: "in" | "out" }).direction,
          snapshotId: (row as { snapshotId: string }).snapshotId,
          ref: {
            kind: (row as { ref: { kind: string } }).ref.kind,
            id: (row as { ref: { id: string } }).ref.id,
          },
        });
      }
    }
    if (rows.length !== rawRows.length) {
      return { ok: false, message: "Unexpected neighbors response from twin API." };
    }
    return { ok: true, rows };
  } catch {
    return { ok: false, message: "Network error while loading neighbor data." };
  }
}

function TwinEntityNeighborsPanelInner({ snapshotId }: { snapshotId: string }) {
  const snapshot = useTwinCachedAsync(`sctwin:entity-neighbors:v1:${snapshotId}`, () => fetchEntityNeighbors(snapshotId));

  if (snapshot.status === "pending") {
    return (
      <div className="px-5 py-6">
        <TwinFallbackState tone="loading" title="Loading neighbors..." />
      </div>
    );
  }

  if (snapshot.status === "rejected") {
    return (
      <div className="px-5 py-6">
        <TwinFallbackState tone="error" title="Unable to load neighbors" description="Network error while loading neighbor data." />
      </div>
    );
  }

  const data = snapshot.data;

  if (data.ok === false) {
    return (
      <div className="px-5 py-6">
        <TwinFallbackState tone="error" title="Unable to load neighbors" description={data.message} />
      </div>
    );
  }

  const incoming = data.rows.filter((row) => row.direction === "in");
  const outgoing = data.rows.filter((row) => row.direction === "out");

  if (data.rows.length === 0) {
    return (
      <div className="px-5 py-8">
        <TwinFallbackState
          centered
          title="No one-hop neighbors for this snapshot."
          description="Edges appear here when incoming or outgoing links exist in the Twin graph."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
      <NeighborList title="Incoming" rows={incoming} />
      <NeighborList title="Outgoing" rows={outgoing} />
    </div>
  );
}

function NeighborList({ title, rows }: { title: string; rows: NeighborRow[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No {title.toLowerCase()} neighbors.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {rows.map((row) => (
            <li key={`${row.edgeId}:${row.direction}`} className="px-3 py-2 text-xs">
              <p className="font-mono text-zinc-800">
                {row.ref.kind} · {row.ref.id}
              </p>
              <p className="mt-1 text-zinc-500">
                Relation: {row.relation ?? "unspecified"} ·{" "}
                <Link
                  href={`/supply-chain-twin/explorer/${encodeURIComponent(row.snapshotId)}`}
                  className="font-semibold text-[var(--arscmp-primary)]"
                >
                  open neighbor
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TwinEntityNeighborsPanel({ snapshotId }: { snapshotId: string }) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">One-hop neighbors</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Grouped by incoming and outgoing edges from{" "}
          <code className="text-[11px]">GET /api/supply-chain-twin/entities/[id]/neighbors</code>.
        </p>
      </div>
      <TwinEntityNeighborsPanelInner snapshotId={snapshotId} />
    </section>
  );
}
