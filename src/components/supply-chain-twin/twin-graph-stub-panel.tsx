"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { useTwinCachedAsync } from "./use-twin-cached-async";

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

/** Preview-only palette so kinds read at a glance (not persisted). */
function kindNodeClasses(kind: string): { circle: string; kindText: string; idText: string; edgeStroke: string } {
  const k = kind.toLowerCase();
  const map: Record<string, { circle: string; kindText: string; idText: string; edgeStroke: string }> = {
    supplier: {
      circle: "fill-violet-50 stroke-violet-400",
      kindText: "fill-violet-950",
      idText: "fill-violet-800",
      edgeStroke: "#8b5cf6",
    },
    warehouse: {
      circle: "fill-amber-50 stroke-amber-500",
      kindText: "fill-amber-950",
      idText: "fill-amber-900",
      edgeStroke: "#d97706",
    },
    site: {
      circle: "fill-emerald-50 stroke-emerald-500",
      kindText: "fill-emerald-950",
      idText: "fill-emerald-900",
      edgeStroke: "#059669",
    },
    sku: {
      circle: "fill-sky-50 stroke-sky-500",
      kindText: "fill-sky-950",
      idText: "fill-sky-900",
      edgeStroke: "#0284c7",
    },
    shipment: {
      circle: "fill-rose-50 stroke-rose-500",
      kindText: "fill-rose-950",
      idText: "fill-rose-900",
      edgeStroke: "#e11d48",
    },
    purchase_order: {
      circle: "fill-indigo-50 stroke-indigo-500",
      kindText: "fill-indigo-950",
      idText: "fill-indigo-900",
      edgeStroke: "#6366f1",
    },
  };
  return (
    map[k] ?? {
      circle: "fill-zinc-50 stroke-zinc-400",
      kindText: "fill-zinc-900",
      idText: "fill-zinc-600",
      edgeStroke: "#71717a",
    }
  );
}

function formatKindLabel(kind: string): string {
  const t = kind.replace(/_/g, " ").trim();
  if (!t) return "unknown";
  return t.length > 10 ? `${t.slice(0, 9)}…` : t;
}

/** Fits two-line label inside the node radius (SVG px, ~ monospace width heuristic). */
function truncateIdForBubble(id: string, maxLen: number): string {
  const t = id.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

function shortenEdgeEndpoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radiusFrom: number,
  radiusTo: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: ax + ux * radiusFrom,
    y1: ay + uy * radiusFrom,
    x2: bx - ux * radiusTo,
    y2: by - uy * radiusTo,
  };
}

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

async function fetchGraphForSnapshot(snapshotId: string): Promise<GraphBundle> {
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
    return fetchGraphForSnapshot(snap);
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
      <span className="w-full text-[11px] font-medium uppercase tracking-wide text-zinc-500">Open in graph</span>
      {pickList.map((row) => {
        const label = `${row.ref.kind}:${row.ref.id}`;
        const shortKind = formatKindLabel(row.ref.kind);
        const idShort = row.ref.id.length > 18 ? `${row.ref.id.slice(0, 17)}…` : row.ref.id;
        const short = `${shortKind} · ${idShort}`;
        const href = `/supply-chain-twin/explorer?${new URLSearchParams({ q: searchQ, focus: row.id }).toString()}`;
        return (
          <button
            key={row.id}
            type="button"
            title={label}
            onClick={() => {
              router.push(href);
            }}
            className="max-w-[240px] truncate rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
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
  const arrowMarkerId = useId().replace(/:/g, "");
  const snapshot = useTwinCachedAsync(`sctwin:graph-bundle:v1:${searchQ}::${selectedSnapshotId ?? ""}`, () =>
    fetchGraphBundle(searchQ, selectedSnapshotId),
  );

  if (snapshot.status === "pending") {
    return <p className="py-12 text-center text-sm text-zinc-500">Loading graph data…</p>;
  }

  if (snapshot.status === "rejected") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Network error while loading graph data.
      </div>
    );
  }

  const data = snapshot.data;

  if (data.ok === false) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{data.message}</div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-600">
        Nothing to draw yet. Add twin entities and edges for this workspace, or choose an entity from the table above.
      </p>
    );
  }

  const pos = new Map(data.nodes.map((n) => [n.key, n] as const));
  const NODE_R = 32;
  const CLIP_PAD = 3;

  return (
    <div className="relative">
      {!selectedSnapshotId && data.pickList.length > 0 ? <ExplorerSnapshotChips searchQ={searchQ} pickList={data.pickList} /> : null}

      <svg viewBox="0 0 400 264" className="mt-4 h-auto w-full max-w-full" aria-hidden="true">
        <defs>
          <marker
            id={arrowMarkerId}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L7,3.5 L0,7 z" fill="#71717a" />
          </marker>
          {data.nodes.map((n, i) => (
            <clipPath key={`clip-${n.key}`} id={`${arrowMarkerId}-clip-${i}`}>
              <circle cx={n.x} cy={n.y} r={NODE_R - CLIP_PAD} />
            </clipPath>
          ))}
        </defs>
        {data.edges.map((e) => {
          const a = pos.get(e.fromKey);
          const b = pos.get(e.toKey);
          if (!a || !b) return null;
          const fromStyle = kindNodeClasses(a.kind);
          const { x1, y1, x2, y2 } = shortenEdgeEndpoints(a.x, a.y, b.x, b.y, NODE_R, NODE_R);
          return (
            <line
              key={e.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={fromStyle.edgeStroke}
              strokeWidth={2}
              strokeOpacity={0.75}
              strokeLinecap="round"
              markerEnd={`url(#${arrowMarkerId})`}
            />
          );
        })}
        {data.nodes.map((n, i) => {
          const st = kindNodeClasses(n.kind);
          const kindLine = formatKindLabel(n.kind);
          const idLine = truncateIdForBubble(n.id, 14);
          const clipId = `${arrowMarkerId}-clip-${i}`;
          return (
            <g key={n.key}>
              <circle cx={n.x} cy={n.y} r={NODE_R} className={`${st.circle}`} strokeWidth={2} />
              <text x={n.x} y={n.y - 4} textAnchor="middle" clipPath={`url(#${clipId})`} className="select-none">
                <tspan x={n.x} dy="0" className={`text-[10px] font-semibold capitalize ${st.kindText}`}>
                  {kindLine}
                </tspan>
                <tspan x={n.x} dy="12" className={`font-mono text-[7.5px] tracking-tight ${st.idText}`}>
                  {idLine}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-xs text-zinc-500">
        {selectedSnapshotId ? (
          <>
            Showing directed links for the selected entity.{" "}
            <Link
              href={`/supply-chain-twin/explorer${searchQ.trim() ? `?${new URLSearchParams({ q: searchQ }).toString()}` : ""}`}
              className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
            >
              Back to catalog view
            </Link>
          </>
        ) : (
          <>
            Preview: {data.nodes.length} node{data.nodes.length === 1 ? "" : "s"}, {data.edges.length} directed link
            {data.edges.length === 1 ? "" : "s"} (sample from your workspace).
          </>
        )}
      </p>
      <details className="mt-2 text-center text-[11px] text-zinc-500">
        <summary className="cursor-pointer font-medium text-zinc-600">API details</summary>
        <p className="mt-1 px-2">
          {selectedSnapshotId ? (
            <>
              <code className="rounded bg-zinc-100 px-1">GET /api/supply-chain-twin/edges?snapshotId=…&amp;direction=both</code>
            </>
          ) : (
            <>
              <code className="rounded bg-zinc-100 px-1">GET /api/supply-chain-twin/entities</code> +{" "}
              <code className="rounded bg-zinc-100 px-1">GET /api/supply-chain-twin/edges</code> (catalog sample)
            </>
          )}
        </p>
      </details>
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
      <p className="mt-1 text-xs text-zinc-600">
        {snap ? (
          <>
            Links for the entity you opened. Arrows follow the direction stored on each edge. Colors match entity type.
          </>
        ) : (
          <>
            A quick map of entities and how they connect in this workspace. Pick a row in the table to zoom the graph on
            one entity, or use the chips below to jump there.
          </>
        )}
      </p>
      <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/90 p-4">
        <TwinGraphStubPanelInner searchQ={searchQ} selectedSnapshotId={snap} />
      </div>
    </section>
  );
}
