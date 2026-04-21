"use client";

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
  | { ok: true; nodes: GraphNodeVm[]; edges: GraphEdgeVm[] }
  | { ok: false; message: string };

function refKey(ref: Ref): string {
  return `${ref.kind}:${ref.id}`;
}

async function fetchGraphBundle(searchQ: string): Promise<GraphBundle> {
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

    const edgeVms: GraphEdgeVm[] = [];
    const nodeKeys = new Set<string>();

    const parseRef = (row: unknown): Ref | null => {
      if (typeof row !== "object" || row == null) return null;
      const r = row as Record<string, unknown>;
      if (typeof r.kind !== "string" || typeof r.id !== "string") return null;
      return { kind: r.kind, id: r.id };
    };

    for (const row of rawEdges.slice(0, 60)) {
      if (typeof row !== "object" || row == null || !("id" in row)) continue;
      const id = (row as { id: unknown }).id;
      if (typeof id !== "string") continue;
      const from = parseRef((row as { from?: unknown }).from);
      const to = parseRef((row as { to?: unknown }).to);
      if (!from || !to) continue;
      const rawRel = (row as { relation?: unknown }).relation;
      const rel =
        rawRel === null || rawRel === undefined ? null : typeof rawRel === "string" ? rawRel : null;
      const fromKey = refKey(from);
      const toKey = refKey(to);
      nodeKeys.add(fromKey);
      nodeKeys.add(toKey);
      edgeVms.push({ id, relation: rel, fromKey, toKey });
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

    return { ok: true, nodes, edges };
  } catch {
    return { ok: false, message: "Network error while loading graph data." };
  }
}

function TwinGraphStubPanelInner({ searchQ }: { searchQ: string }) {
  const data = use(useMemo(() => fetchGraphBundle(searchQ), [searchQ]));

  if (data.ok === false) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{data.message}</div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-600">
        No nodes to plot yet — seed entities/edges or widen search. APIs: entities + edges.
      </p>
    );
  }

  const pos = new Map(data.nodes.map((n) => [n.key, n] as const));

  return (
    <div className="relative">
      <svg viewBox="0 0 400 264" className="h-auto w-full max-w-full text-zinc-400" aria-hidden="true">
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
            <text
              x={n.x}
              y={n.y - 4}
              textAnchor="middle"
              className="fill-zinc-700 text-[9px] font-mono"
            >
              {n.kind.length > 10 ? `${n.kind.slice(0, 9)}…` : n.kind}
            </text>
            <text x={n.x} y={n.y + 8} textAnchor="middle" className="fill-zinc-600 text-[8px]">
              {n.id.length > 12 ? `${n.id.slice(0, 11)}…` : n.id}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-center text-xs text-zinc-500">
        Read-only stub layout (no graph engine). {data.nodes.length} node{data.nodes.length === 1 ? "" : "s"},{" "}
        {data.edges.length} edge{data.edges.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

export function TwinGraphStubPanel({ searchQ }: { searchQ: string }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Graph preview</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Nodes merge entity catalog refs with edge endpoints. Edges from <code className="text-[11px]">GET /api/supply-chain-twin/edges</code>
        ; layout is fixed-geometry mock (no new layout dependency).
      </p>
      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/90 p-4">
        <Suspense fallback={<p className="py-12 text-center text-sm text-zinc-500">Loading graph data…</p>}>
          <TwinGraphStubPanelInner searchQ={searchQ} />
        </Suspense>
      </div>
    </section>
  );
}
