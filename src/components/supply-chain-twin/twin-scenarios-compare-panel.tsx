"use client";

import { useEffect, useMemo, useState } from "react";

import { computeDraftTopLevelKeyDiffV1, draftsDeepEqualSerialized } from "./scenario-draft-compare-summary";
import type { TwinScenarioDraftQueryParse } from "./twin-scenario-draft-id";
import { TwinScenarioDraftKeyDiffSummary } from "./twin-scenario-draft-key-diff-summary";

type ScenarioDraftDetail = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  draft: unknown;
};

type PaneState =
  | { status: "idle"; reason: "missing_id" | "missing_peer" | "invalid_id" | "peer_not_ready" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: ScenarioDraftDetail };

const PREVIEW_MAX_UTF8_BYTES = 8_000;
/** Above this UTF-8 size, the UI starts collapsed with an expand stub (read-only preview). */
const COLLAPSE_WHEN_UTF8_BYTES = 2_600;
const COLLAPSED_PREVIEW_UTF8_BYTES = 1_200;

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

function formatJsonPreview(payload: unknown, maxBytes: number = PREVIEW_MAX_UTF8_BYTES): { text: string; truncated: boolean } {
  let raw: string;
  try {
    raw = JSON.stringify(payload ?? null, null, 2);
  } catch {
    raw = "(unable to serialize draft JSON)";
  }
  return truncateUtf8(raw, maxBytes);
}

function draftUtf8ByteLength(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload ?? null)).length;
  } catch {
    return 0;
  }
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

/** Twin compare UI never surfaces raw API error strings (only stable copy by status). */
function safeErrorMessage(status: number): string {
  if (status === 403) {
    return "You do not have access to scenario drafts in this workspace.";
  }
  if (status === 404) {
    return "Draft not found or not available for this workspace.";
  }
  if (status === 400) {
    return "Invalid draft id.";
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
      return { ok: false, message: safeErrorMessage(res.status) };
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

function idlePaneForSide(side: TwinScenarioDraftQueryParse, peer: TwinScenarioDraftQueryParse): PaneState {
  if (side.status === "invalid") {
    return { status: "idle", reason: "invalid_id" };
  }
  if (side.status === "missing") {
    return { status: "idle", reason: "missing_id" };
  }
  if (peer.status !== "ok") {
    return { status: "idle", reason: "peer_not_ready" };
  }
  return { status: "loading" };
}

export function TwinScenariosComparePanel(props: { left: TwinScenarioDraftQueryParse; right: TwinScenarioDraftQueryParse }) {
  const { left, right } = props;
  const [leftPane, setLeftPane] = useState<PaneState>(() => idlePaneForSide(left, right));
  const [rightPane, setRightPane] = useState<PaneState>(() => idlePaneForSide(right, left));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback" | "error">("idle");

  useEffect(() => {
    if (left.status !== "ok" || right.status !== "ok") {
      setLeftPane(idlePaneForSide(left, right));
      setRightPane(idlePaneForSide(right, left));
      return;
    }

    setLeftPane({ status: "loading" });
    setRightPane({ status: "loading" });

    let cancelled = false;
    void (async () => {
      const [l, r] = await Promise.all([fetchScenarioDraft(left.id), fetchScenarioDraft(right.id)]);
      if (cancelled) {
        return;
      }
      setLeftPane(l.ok ? { status: "ok", data: l.data } : { status: "error", message: l.message });
      setRightPane(r.ok ? { status: "ok", data: r.data } : { status: "error", message: r.message });
    })();

    return () => {
      cancelled = true;
    };
  }, [left, right]);

  const diffSummary = useMemo(() => {
    if (leftPane.status !== "ok" || rightPane.status !== "ok") {
      return null;
    }
    const diff = computeDraftTopLevelKeyDiffV1(leftPane.data.draft, rightPane.data.draft);
    const deep = draftsDeepEqualSerialized(leftPane.data.draft, rightPane.data.draft);
    const deepLine =
      deep === null
        ? "Serialized draft bodies: not compared (payload too large for a quick check)."
        : deep
          ? "Serialized draft bodies: match."
          : "Serialized draft bodies: differ.";
    return { diff, deepLine };
  }, [leftPane, rightPane]);

  async function onCopyShareLink() {
    const href = window.location.href;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
        setCopyState("copied");
        return;
      }
    } catch {
      // Fallback below when async clipboard is blocked.
    }

    try {
      const el = document.createElement("textarea");
      el.value = href;
      el.setAttribute("readonly", "true");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      setCopyState(ok ? "fallback" : "error");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">Share this compare view with the current URL parameters.</p>
          <button
            type="button"
            onClick={onCopyShareLink}
            aria-label="Copy compare link"
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95"
          >
            Copy share link
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-600" aria-live="polite">
          {copyState === "copied" ? "Copied compare URL." : null}
          {copyState === "fallback" ? "Copied compare URL using browser fallback." : null}
          {copyState === "error" ? "Could not copy automatically. Copy the URL from your browser address bar." : null}
        </p>
      </section>
      {diffSummary ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Diff (read-only)</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Top-level key buckets plus a capped{" "}
            <span className="font-medium text-zinc-800">depth-2 path</span> strip for object-valued changed keys (dot
            paths such as <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">shocks.delay</code>). No graph
            solver or heavy diff library.
          </p>
          <div className="mt-4">
            <TwinScenarioDraftKeyDiffSummary diff={diffSummary.diff} deepLine={diffSummary.deepLine} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ComparePane label="Left draft" state={leftPane} side="left" />
        <ComparePane label="Right draft" state={rightPane} side="right" />
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
          Add a <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">{param}</code> query parameter with a draft id
          from your scenarios list.
        </p>
      ) : null}
      {state.status === "idle" && state.reason === "invalid_id" ? (
        <p className="mt-3 text-sm text-zinc-600">
          The <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">{param}</code> value in the address bar does not
          look like a valid draft id (expect a short lowercase token from the list). Nothing was requested from the
          server for this side.
        </p>
      ) : null}
      {state.status === "idle" && state.reason === "missing_peer" ? (
        <p className="mt-3 text-sm text-zinc-600">
          Add both <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> with valid ids to run the comparison.
        </p>
      ) : null}
      {state.status === "idle" && state.reason === "peer_not_ready" ? (
        <p className="mt-3 text-sm text-zinc-600">
          This side is ready, but the other query parameter is missing or not valid. Fix both{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> in the URL to load drafts.
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
          <DraftJsonBlock draftKey={state.data.id} draft={state.data.draft} />
        </div>
      ) : null}
    </section>
  );
}

function DraftJsonBlock({ draftKey, draft }: { draftKey: string; draft: unknown }) {
  const fullBytes = useMemo(() => draftUtf8ByteLength(draft), [draft]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [draftKey, draft]);

  const needsCollapseStub = fullBytes > COLLAPSE_WHEN_UTF8_BYTES;
  const maxBytes = expanded || !needsCollapseStub ? PREVIEW_MAX_UTF8_BYTES : COLLAPSED_PREVIEW_UTF8_BYTES;
  const { text, truncated } = useMemo(() => formatJsonPreview(draft, maxBytes), [draft, maxBytes]);

  return (
    <div className="space-y-2">
      {needsCollapseStub ? (
        <div className="flex flex-wrap items-center gap-2">
          {expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Collapse preview
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              Expand preview (read-only stub)
            </button>
          )}
          <span className="text-xs text-zinc-500">Large draft JSON is shortened until expanded.</span>
        </div>
      ) : null}
      <pre className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-800">
        {text}
      </pre>
      {truncated ? (
        <p className="text-xs text-zinc-500">
          Preview truncated for size in the browser. Full JSON is available via the scenarios API.
        </p>
      ) : null}
    </div>
  );
}
