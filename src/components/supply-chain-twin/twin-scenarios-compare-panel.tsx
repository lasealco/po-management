"use client";

import { useEffect, useMemo, useState } from "react";

import { describeDraftRootKeyDiff, draftsDeepEqualSerialized } from "./scenario-draft-compare-summary";

type ScenarioDraftDetail = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  draft: unknown;
};

type PaneState =
  | { status: "idle"; reason: "missing_id" | "missing_peer" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: ScenarioDraftDetail };

const PREVIEW_MAX_UTF8_BYTES = 8_000;

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= maxBytes) {
    return { text, truncated: false };
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = text.slice(0, mid);
    if (enc.encode(slice).length <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const cut = text.slice(0, lo);
  return { text: `${cut}\n…`, truncated: true };
}

function formatJsonPreview(payload: unknown): { text: string; truncated: boolean } {
  let raw: string;
  try {
    raw = JSON.stringify(payload ?? null, null, 2);
  } catch {
    raw = "(unable to serialize draft JSON)";
  }
  return truncateUtf8(raw, PREVIEW_MAX_UTF8_BYTES);
}

function parseDetailPayload(body: unknown): { ok: true; data: ScenarioDraftDetail } | { ok: false } {
  if (typeof body !== "object" || body == null) {
    return { ok: false };
  }
  const o = body as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    o.id.length === 0 ||
    (o.title !== null && typeof o.title !== "string") ||
    typeof o.status !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string" ||
    !("draft" in o)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    data: {
      id: o.id,
      title: o.title as string | null,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      draft: o.draft,
    },
  };
}

function safeErrorMessage(status: number, body: unknown): string {
  if (status === 403) {
    return "You do not have access to scenario drafts in this workspace.";
  }
  if (status === 404) {
    return "Draft not found or not available for this workspace.";
  }
  if (status === 400) {
    return "Invalid draft id.";
  }
  if (typeof body === "object" && body != null && "error" in body && typeof (body as { error: unknown }).error === "string") {
    const msg = (body as { error: string }).error.trim();
    if (msg.length > 0 && msg.length < 200) {
      return msg;
    }
  }
  if (status >= 500) {
    return "Could not load draft. Try again later.";
  }
  return "Could not load draft.";
}

async function fetchScenarioDraft(id: string): Promise<{ ok: true; data: ScenarioDraftDetail } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/supply-chain-twin/scenarios/${encodeURIComponent(id)}`, { cache: "no-store" });
    const body = (await res.json()) as unknown;
    if (!res.ok) {
      return { ok: false, message: safeErrorMessage(res.status, body) };
    }
    const parsed = parseDetailPayload(body);
    if (!parsed.ok) {
      return { ok: false, message: "Unexpected response from scenarios API." };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, message: "Network error while loading draft." };
  }
}

function idlePane(id: string | null, peerPresent: boolean): PaneState {
  if (!id) {
    return { status: "idle", reason: "missing_id" };
  }
  if (!peerPresent) {
    return { status: "idle", reason: "missing_peer" };
  }
  return { status: "loading" };
}

export function TwinScenariosComparePanel(props: { leftId: string | null; rightId: string | null }) {
  const { leftId, rightId } = props;
  const [left, setLeft] = useState<PaneState>(() => idlePane(leftId, Boolean(rightId)));
  const [right, setRight] = useState<PaneState>(() => idlePane(rightId, Boolean(leftId)));

  useEffect(() => {
    if (!leftId || !rightId) {
      setLeft(idlePane(leftId, Boolean(rightId)));
      setRight(idlePane(rightId, Boolean(leftId)));
      return;
    }

    setLeft({ status: "loading" });
    setRight({ status: "loading" });

    let cancelled = false;
    void (async () => {
      const [l, r] = await Promise.all([fetchScenarioDraft(leftId), fetchScenarioDraft(rightId)]);
      if (cancelled) {
        return;
      }
      setLeft(l.ok ? { status: "ok", data: l.data } : { status: "error", message: l.message });
      setRight(r.ok ? { status: "ok", data: r.data } : { status: "error", message: r.message });
    })();

    return () => {
      cancelled = true;
    };
  }, [leftId, rightId]);

  const diffSummary = useMemo(() => {
    if (left.status !== "ok" || right.status !== "ok") {
      return null;
    }
    const keysLine = describeDraftRootKeyDiff(left.data.draft, right.data.draft);
    const deep = draftsDeepEqualSerialized(left.data.draft, right.data.draft);
    const deepLine =
      deep === null
        ? "Serialized draft bodies: not compared (payload too large for a quick check)."
        : deep
          ? "Serialized draft bodies: match."
          : "Serialized draft bodies: differ.";
    return { keysLine, deepLine };
  }, [left, right]);

  return (
    <div className="space-y-6">
      {diffSummary ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Diff (read-only)</h2>
          <p className="mt-2 text-sm text-zinc-700">{diffSummary.keysLine}</p>
          <p className="mt-1 text-sm text-zinc-600">{diffSummary.deepLine}</p>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ComparePane label="Left draft" state={left} side="left" />
        <ComparePane label="Right draft" state={right} side="right" />
      </div>
    </div>
  );
}

function ComparePane(props: { label: string; state: PaneState; side: "left" | "right" }) {
  const { label, state, side } = props;
  const param = side === "left" ? "left" : "right";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{label}</h2>
      {state.status === "idle" && state.reason === "missing_id" ? (
        <p className="mt-3 text-sm text-zinc-600">
          Add a <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">{param}</code> query parameter (draft id from
          your list) to load this pane.
        </p>
      ) : null}
      {state.status === "idle" && state.reason === "missing_peer" ? (
        <p className="mt-3 text-sm text-zinc-600">
          Add both <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> ids in the URL to run the comparison.
        </p>
      ) : null}
      {state.status === "loading" ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : null}
      {state.status === "error" ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{state.message}</p>
      ) : null}
      {state.status === "ok" ? (
        <div className="mt-3 space-y-3">
          <div className="text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">{state.data.title?.trim() ? state.data.title : "Untitled"}</span>
            <span className="mx-2 text-zinc-400">·</span>
            <span>{state.data.status}</span>
            <span className="mx-2 text-zinc-400">·</span>
            <span className="font-mono text-[11px] text-zinc-500">{state.data.id}</span>
          </div>
          <DraftJsonBlock draft={state.data.draft} />
        </div>
      ) : null}
    </section>
  );
}

function DraftJsonBlock({ draft }: { draft: unknown }) {
  const { text, truncated } = formatJsonPreview(draft);
  return (
    <div className="space-y-2">
      <pre className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-800">
        {text}
      </pre>
      {truncated ? (
        <p className="text-xs text-zinc-500">Preview truncated for size. Full JSON is available via the scenarios API.</p>
      ) : null}
    </div>
  );
}
