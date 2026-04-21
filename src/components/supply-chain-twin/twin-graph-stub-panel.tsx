"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useMemo } from "react";

type Ref = { kind: string; id: string };

type GraphNodeVm = {
  key: string;
  kind: string;
  id: string;
  x: number;
  y: number;
};

type GraphEdgeVm = {
  id: string;
  relation: string | null;
  fromKey: string;
  toKey: string;
};

type GraphBundle =
  | { ok: true; nodes: GraphNodeVm[]; edges: GraphEdgeVm[]; pickList: { id: string; ref: Ref }[] }
  | { ok: false; message: string };

function refKey(ref: Ref): string {
  return `${ref.kind}:${ref.id}`;
}

function parseRef(row: unknown): Ref | null {
  if (typeof row !== "object" || row == null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.kind !== "string" || typeof r.id !== "string") return null;
  return { kind: r.kind, id: r.id };
}

function parseEdgeRow(row: unknown): GraphEdgeVm | null {
  if (typeof row !== "object" || row == null || !("id" in row)) return null;
  const id = (row as { id: unknown }).id;
  if (typeof id !== "string") return null;
  const from = parseRef((row as { from?: unknown }).from);
  const to = parseRef((row as { to?: unknown }).to);
  if (!from || !to) return null;
  const rawRel = (row as { relation?: unknown }).relation;
  const rel = rawRel === null || rawRel === undefined ? null : typeof rawRel === "string" ? rawRel : null;
  return { id, relation: rel, fromKey: refKey(from), toKey: refKey(to) };
}

async function fetchGraphForSnapshot(snapshotId: string, _searchQ: string): Promise<GraphBundle> {
  const edgeParams = new URLSearchParams();
  edgeParams.set("snapshotId", snapshotId);
  edgeParams.set("direction", "both");
  edgeParams.set("take", "120");

  try {
    const [resEdge, resEnt] = await Promise.all([
      fetch(`/api/supply-chain-twin/edges?${edgeParams.toString()}`, { cache: "no-store" }),
      fetch(`/api/supply-chain-twin/entities/${encodeURIComponent(snapshotId)}`, { cache: "no-store" }),
    ]);

    const bodyEdge: unknown = await resEdge.json().catch(() => null);
    const bodyEnt: unknown = await resEnt.json().catch(() => null);

    if (!resEnt.ok) {
      const msg =
        resEnt.status === 404
          ? "Selected snapshot was not found for this tenant."
          : typeof bodyEnt === "object" && bodyEnt != null && "error" in bodyEnt && typeof (bodyEnt as { error: unknown }).error === "string"
            ? (bodyEnt as { error: string }).error
            : "Entity snapshot request failed.";
      return { ok: false, message: msg };
    }
    if (!resEdge.ok) {
      const msg =
        typeof bodyEdge === "object" && bodyEdge != null && "error" in bodyEdge && typeof (bodyEdge as { error: unknown }).error === "string"
          ? (bodyEdge as { error: string }).error
          : "Edges request failed.";
      return { ok: false, message: msg };
    }

    if (
      typeof bodyEnt !== "object" ||
      bodyEnt == null ||
      !("ref" in bodyEnt) ||
      typeof (bodyEnt as { ref: unknown }).ref !== "object"
    ) {
      return { ok: false, message: "Unexpected entity detail response." };
    }
    const centerRef = parseRef((bodyEnt as { ref: unknown }).ref);
    if (!centerRef) {
      return { ok: false, message: "Unexpected entity detail response." };
    }

    if (
      typeof bodyEdge !== "object" ||
      bodyEdge == null ||
      !("edges" in bodyEdge) ||
      !Array.isArray((bodyEdge as { edges: unknown }).edges)
    ) {
      return { ok: false, message: "Unexpected edge response." };
    }

    const rawEdges = (bodyEdge as { edges: unknown[] }).edges;
    const edgeVms: GraphEdgeVm[] = [];
    const nodeKeys = new Set<string>();
    nodeKeys.add(refKey(centerRef));

    for (const row of rawEdges) {
      const e = parseEdgeRow(row);
      if (!e) continue;
      edgeVms.push(e);
      nodeKeys.add(e.fromKey);
      nodeKeys.add(e.toKey);
    }

    const centerKey = refKey(centerRef);
    const others = [...nodeKeys].filter((k) => k !== centerKey);
    const keys = [centerKey, ...others].slice(0, 24);

    const cx = 200;
    const cy = 132;
    const rx = 150;
    const ry = 100;
    const nodes: GraphNodeVm[] = keys.map((key, i) => {
      const sep = key.indexOf(":");
      const kind = sep >= 0 ? key.slice(0, sep) : "unknown";
      const id = sep >= 0 ? key.slice(sep + 1) : key;
      if (i === 0) {
        return { key, kind: kind || "unknown", id: id || key, x: cx, y: cy };
      }
      const angle = (2 * Math.PI * (i - 1)) / Math.max(keys.length - 1, 1) - Math.PI / 2;
      return {
        key,
        kind: kind || "unknown",
        id: id || key,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      };
    });

    const pos = new Map(nodes.map((n) => [n.key, n] as const));
    const edges = edgeVms.filter((e) => pos.has(e.fromKey) && pos.has(e.toKey));

    return { ok: true, nodes, edges, pickList: [] };
  } catch {
    return { ok: false, message: "Network error while loading graph data." };
  }
}

async function fetchGraphCatalogMode(searchQ: string): Promise<GraphBundle> {
  const entityParams = new URLSearchParams();
  entityParams.set("q", searchQ);
  entityParams.set("limit", "40");
  const edgeParams = new URLSearchParams();
  edgeParams.set("take", "60");

  try {
    const [resEnt, resEdge] = await Promise.all([
      fetch(`/api/supply-chain-twin/entities?${entityParams.toString()}`, { cache: "no-store" }),
      fetch(`/api/supply-chain-twin/edges?${edgeParams.toString()}`, { cache: "no-store" }),
    ]);

    const bodyEnt: unknown = await resEnt.json().catch(() => null);
    const bodyEdge: unknown = await resEdge.json().catch(() => null);

    if (!resEnt.ok) {
      const msg =
        typeof bodyEnt === "object" && bodyEnt != null && "error" in bodyEnt && typeof (bodyEnt as { error: unknown }).error === "string"
          ? (bodyEnt as { error: string }).error
          : "Entity catalog request failed.";
      return { ok: false, message: msg };
    }
    if (!resEdge.ok) {
      const msg =
        typeof bodyEdge === "object" && bodyEdge != null && "error" in bodyEdge && typeof (bodyEdge as { error: unknown }).error === "string"
          ? (bodyEdge as { error: string }).error
          : "Edge catalog request failed.";
      return { ok: false, message: msg };
    }

    if (
      typeof bodyEnt !== "object" ||
      bodyEnt == null ||
      !("items" in bodyEnt) ||
      !Array.isArray((bodyEnt as { items: unknown }).items)
    ) {
      return { ok: false, message: "Unexpected entity catalog response." };
    }
    if (
      typeof bodyEdge !== "object" ||
      bodyEdge == null ||
      !("edges" in bodyEdge) ||
      !Array.isArray((bodyEdge as { edges: unknown }).edges)
    ) {
      return { ok: false, message: "Unexpected edge catalog response." };
    }

    const items = (bodyEnt as { items: unknown[] }).items;
    const rawEdges = (bodyEdge as { edges: unknown[] }).edges;

    const pickList: { id: string; ref: Ref }[] = [];
    for (const row of items.slice(0, 15)) {
      if (typeof row !== "object" || row == null || !("id" in row) || !("ref" in row)) continue;
      const id = (row as { id: unknown }).id;
      const ref = parseRef((row as { ref: unknown }).ref);
      if (typeof id !== "string" || !ref) continue;
      pickList.push({ id, ref });
    }

    const edgeVms: GraphEdgeVm[] = [];
    const nodeKeys = new Set<string>();

    for (const row of rawEdges.slice(0, 60)) {
      const e = parseEdgeRow(row);
      if (!e) continue;
      edgeVms.push(e);
      nodeKeys.add(e.fromKey);
      nodeKeys.add(e.toKey);
    }

    for (const row of items) {
      if (typeof row !== "object" || row == null || !("ref" in row)) continue;
      const ref = parseRef((row as { ref: unknown }).ref);
      if (!ref) continue;
      nodeKeys.add(refKey(ref));
    }

    const keys = [...nodeKeys].slice(0, 24);
    const cx = 200;
    const cy = 132;
    const rx = 150;
    const ry = 100;
    const nodes: GraphNodeVm[] = keys.map((key, i) => {
      const sep = key.indexOf(":");
      const kind = sep >= 0 ? key.slice(0, sep) : "unknown";
      const id = sep >= 0 ? key.slice(sep + 1) : key;
      const angle = (2 * Math.PI * i) / Math.max(keys.length, 1) - Math.PI / 2;
      return {
        key,
        kind: kind || "unknown",
        id: id || key,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      };
    });

    const pos = new Map(nodes.map((n) => [n.key, n] as const));
    const edges = edgeVms.filter((e) => pos.has(e.fromKey) && pos.has(e.toKey));

    return { ok: true, nodes, edges, pickList };
  } catch {
    return { ok: false, message: "Network error while loading graph data." };
  }
}

async function fetchGraphBundle(searchQ: string, selectedSnapshotId: string | null): Promise<GraphBundle> {
  const snap = selectedSnapshotId?.trim() || null;
  if (snap) {
    return fetchGraphForSnapshot(snap, searchQ);
  }
  return fetchGraphCatalogMode(searchQ);
}

function ExplorerSnapshotChips({
  searchQ,
  pickList,
}: {
  searchQ: string;
  pickList: { id: string; ref: Ref }[];
}) {
  const router = useRouter();
  if (pickList.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="w-full text-[11px] font-medium uppercase tracking-wide text-zinc-500">Focus edges on snapshot</span>
      {pickList.map((row) => {
        const label = `${row.ref.kind}:${row.ref.id}`;
        const short = label.length > 28 ? `${label.slice(0, 27)}…` : label;
        const href = `/supply-chain-twin/explorer?${new URLSearchParams({ q: searchQ, snapshot: row.id }).toString()}`;
        return (
          <button
            key={row.id}
            type="button"
            title={label}
            onClick={() => {
              router.push(href);
            }}
            className="max-w-[220px] truncate rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left font-mono text-[11px] text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

function TwinGraphStubPanelInner({
  searchQ,
  selectedSnapshotId,
}: {
  searchQ: string;
  selectedSnapshotId: string | null;
}) {
  const data = use(useMemo(() => fetchGraphBundle(searchQ, selectedSnapshotId), [searchQ, selectedSnapshotId]));

  if (data.ok === false) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{data.message}</div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-600">
        No nodes to plot yet — seed entities/edges or pick a snapshot above. APIs: entities + edges.
      </p>
    );
  }

  const pos = new Map(data.nodes.map((n) => [n.key, n] as const));

  return (
    <div className="relative">
      {!selectedSnapshotId && data.pickList.length > 0 ? <ExplorerSnapshotChips searchQ={searchQ} pickList={data.pickList} /> : null}

      <svg viewBox="0 0 400 264" className="mt-4 h-auto w-full max-w-full text-zinc-400" aria-hidden="true">
        {data.edges.map((e) => {
          const a = pos.get(e.fromKey);
          const b = pos.get(e.toKey);
          if (!a || !b) return null;
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeWidth={1.25}
              strokeOpacity={0.55}
            />
          );
        })}
        {data.nodes.map((n) => (
          <g key={n.key}>
            <circle cx={n.x} cy={n.y} r={22} className="fill-white stroke-zinc-300" strokeWidth={1.5} />
            <text x={n.x} y={n.y - 4} textAnchor="middle" className="fill-zinc-700 text-[9px] font-mono">
              {n.kind.length > 10 ? `${n.kind.slice(0, 9)}…` : n.kind}
            </text>
            <text x={n.x} y={n.y + 8} textAnchor="middle" className="fill-zinc-600 text-[8px]">
              {n.id.length > 12 ? `${n.id.slice(0, 11)}…` : n.id}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs text-zinc-500">
        {selectedSnapshotId ? (
          <>
            Live edges for <code className="text-[11px]">GET /api/supply-chain-twin/edges?snapshotId=…&amp;direction=both</code>.{" "}
            <Link
              href={`/supply-chain-twin/explorer?${new URLSearchParams({ q: searchQ }).toString()}`}
              className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
            >
              Clear snapshot focus
            </Link>
          </>
        ) : (
          <>
            Catalog mode: edges from <code className="text-[11px]">GET /api/supply-chain-twin/edges</code> (no{" "}
            <code className="text-[11px]">snapshotId</code>). {data.nodes.length} node{data.nodes.length === 1 ? "" : "s"},{" "}
            {data.edges.length} edge{data.edges.length === 1 ? "" : "s"}.
          </>
        )}
      </p>
    </div>
  );
}

export function TwinGraphStubPanel({
  searchQ,
  selectedSnapshotId = null,
}: {
  searchQ: string;
  /** Prisma snapshot row id — drives `edges?snapshotId=…&direction=both` (Slice 42). */
  selectedSnapshotId?: string | null;
}) {
  const snap = selectedSnapshotId?.trim() || null;
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Graph preview</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {snap ? (
          <>
            Showing edges linked to snapshot <code className="text-[11px]">{snap}</code> (tenant-scoped). Center node is
            that snapshot; neighbors come from edge endpoints.
          </>
        ) : (
          <>
            Pick a catalog row below to load <code className="text-[11px]">snapshotId</code> edges, or stay in catalog mode
            (entities + global edge sample). Layout stays fixed-geometry (no new layout dependency).
          </>
        )}
      </p>
      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/90 p-4">
        <Suspense
          key={`${searchQ}::${snap ?? ""}`}
          fallback={<p className="py-12 text-center text-sm text-zinc-500">Loading graph data…</p>}
        >
          <TwinGraphStubPanelInner searchQ={searchQ} selectedSnapshotId={snap} />
        </Suspense>
      </div>
    </section>
  );
}
