"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { AssistSuggestedFilters } from "@/lib/control-tower/assist";
import { CONTROL_TOWER_POST_ACTION_HANDLER_COUNT } from "@/lib/control-tower/assist-tool-catalog";
import {
  controlTowerListPrimaryTitle,
  controlTowerListSecondaryRef,
} from "@/lib/control-tower/shipment-list-label";
import {
  appendAssistToSearchParams,
  hasStructuredSearchInput,
  mergeRawControlTowerSearchInput,
  parseControlTowerProductTraceParam,
} from "@/lib/control-tower/search-query";

function parseWorkbenchStyleShipmentIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ).slice(0, 100);
}

type Hit = {
  id: string;
  orderNumber: string;
  shipmentNo: string | null;
  status: string;
  transportMode: string | null;
  carrier: string | null;
  originCode: string | null;
  destinationCode: string | null;
};

function buildWorkbenchUrl(filters: AssistSuggestedFilters, rawInput: string): string {
  const sp = new URLSearchParams();
  appendAssistToSearchParams(sp, filters);
  mergeRawControlTowerSearchInput(sp, rawInput);
  return `/control-tower/workbench?${sp.toString()}`;
}

export function ControlTowerSearchClient() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<AssistSuggestedFilters | null>(null);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [usedLlm, setUsedLlm] = useState(false);
  const [assistDocEmbeddings, setAssistDocEmbeddings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Shown when assist fails but search still runs on raw / partial input. */
  const [assistWarn, setAssistWarn] = useState<string | null>(null);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searchLimit, setSearchLimit] = useState<number | null>(null);
  const [postActionToolCatalog, setPostActionToolCatalog] = useState<
    Array<{ action: string; group: string; label: string; description: string }>
  >([]);
  const [canExecuteControlTowerPostActions, setCanExecuteControlTowerPostActions] = useState(false);
  const [postActionHandlerCount, setPostActionHandlerCount] = useState<number | null>(null);
  const [assistExecCatalog, setAssistExecCatalog] = useState<
    Array<{ action: string; group: string; label: string; description: string }>
  >([]);
  const [assistExecutePath, setAssistExecutePath] = useState<string | null>(null);
  const [execAction, setExecAction] = useState("acknowledge_ct_alert");
  const [execAlertId, setExecAlertId] = useState("");
  const [execNoteShipmentId, setExecNoteShipmentId] = useState("");
  const [execNoteBody, setExecNoteBody] = useState("");
  const [execNoteVisibility, setExecNoteVisibility] = useState<"INTERNAL" | "SHARED">("INTERNAL");
  const [execBulkShipmentIdsText, setExecBulkShipmentIdsText] = useState("");
  const [execExceptionId, setExecExceptionId] = useState("");
  const [execOwnerUserId, setExecOwnerUserId] = useState("");
  const [execBusy, setExecBusy] = useState(false);
  const [execMessage, setExecMessage] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const workbenchHref = useMemo(() => {
    if (!suggested && !q.trim()) return "/control-tower/workbench";
    return buildWorkbenchUrl(suggested ?? {}, q);
  }, [suggested, q]);

  const runAssistExecute = useCallback(async () => {
    if (!canExecuteControlTowerPostActions || !assistExecutePath) return;
    setExecBusy(true);
    setExecError(null);
    setExecMessage(null);
    try {
      let payload: Record<string, unknown>;
      if (execAction === "acknowledge_ct_alert") {
        payload = { alertId: execAlertId.trim() };
      } else if (execAction === "create_ct_note") {
        payload = {
          shipmentId: execNoteShipmentId.trim(),
          body: execNoteBody,
          visibility: execNoteVisibility,
        };
      } else if (execAction === "bulk_acknowledge_ct_alerts") {
        payload = { shipmentIds: parseWorkbenchStyleShipmentIds(execBulkShipmentIdsText) };
      } else if (execAction === "assign_ct_exception_owner") {
        const t = execOwnerUserId.trim();
        payload = {
          exceptionId: execExceptionId.trim(),
          ownerUserId: t.length ? t : null,
        };
      } else if (execAction === "bulk_assign_ct_exception_owner") {
        const t = execOwnerUserId.trim();
        payload = {
          shipmentIds: parseWorkbenchStyleShipmentIds(execBulkShipmentIdsText),
          ownerUserId: t.length ? t : null,
        };
      } else {
        throw new Error("Unknown action.");
      }

      if (execAction === "acknowledge_ct_alert" && !execAlertId.trim()) {
        throw new Error("Enter the alert id (cuid) from the shipment 360 or alert row.");
      }
      if (execAction === "create_ct_note") {
        if (!execNoteShipmentId.trim() || !execNoteBody.trim()) {
          throw new Error("Shipment id and note text are required.");
        }
      }
      if (execAction === "bulk_acknowledge_ct_alerts" || execAction === "bulk_assign_ct_exception_owner") {
        const shipmentIds = parseWorkbenchStyleShipmentIds(execBulkShipmentIdsText);
        if (shipmentIds.length === 0) {
          throw new Error("Enter at least one shipment id (up to 100, separated by commas or new lines).");
        }
      }
      if (execAction === "assign_ct_exception_owner" && !execExceptionId.trim()) {
        throw new Error("Exception id (cuid) is required.");
      }
      const res = await fetch(assistExecutePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: execAction,
          payload,
          confirmed: true,
          assistContext: {
            lastSearchQuery: q.trim() || undefined,
            clientRequestId: globalThis.crypto?.randomUUID?.() ?? `assist-${Date.now()}`,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setExecMessage("Change applied. Review Shipment 360 or audit for details.");
    } catch (e) {
      setExecError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setExecBusy(false);
    }
  }, [
    assistExecutePath,
    canExecuteControlTowerPostActions,
    execAction,
    execAlertId,
    execBulkShipmentIdsText,
    execExceptionId,
    execNoteBody,
    execNoteShipmentId,
    execNoteVisibility,
    execOwnerUserId,
    q,
  ]);

  const productTraceHref = useMemo(() => {
    const trimmed = q.trim();
    const fromRaw = trimmed && parseControlTowerProductTraceParam(trimmed) === trimmed ? trimmed : "";
    const fromAssist = suggested?.productTraceQ?.trim() ?? "";
    const code = fromRaw || fromAssist;
    if (!code) return null;
    return `/control-tower/product-trace?q=${encodeURIComponent(code)}`;
  }, [q, suggested?.productTraceQ]);

  const run = useCallback(async () => {
    const raw = q.trim();
    setBusy(true);
    setErr(null);
    setAssistWarn(null);
    setSearchTruncated(false);
    setSearchLimit(null);
    setPostActionToolCatalog([]);
    setCanExecuteControlTowerPostActions(false);
    setPostActionHandlerCount(null);
    setAssistExecCatalog([]);
    setAssistExecutePath(null);
    setExecMessage(null);
    setExecError(null);
    try {
      const assistRes = await fetch("/api/control-tower/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: raw }),
      });
      let assistJson: {
        hints?: string[];
        suggestedFilters?: AssistSuggestedFilters;
        capabilities?: { llmAssist?: boolean; assistDocEmbeddings?: boolean };
        usedLlm?: boolean;
        error?: string;
        postActionToolCatalog?: Array<{
          action: string;
          group: string;
          label: string;
          description: string;
        }>;
        canExecuteControlTowerPostActions?: boolean;
        assistExecutablePostActionToolCatalog?: Array<{
          action: string;
          group: string;
          label: string;
          description: string;
        }>;
        assistExecutePostActionPath?: string;
      } = {};
      try {
        assistJson = (await assistRes.json()) as typeof assistJson;
      } catch {
        assistJson = {};
      }
      if (assistRes.ok) {
        setHints(assistJson.hints ?? []);
        setSuggested(assistJson.suggestedFilters ?? {});
        setLlmAvailable(Boolean(assistJson.capabilities?.llmAssist));
        setUsedLlm(Boolean(assistJson.usedLlm));
        setAssistDocEmbeddings(Boolean(assistJson.capabilities?.assistDocEmbeddings));
        setPostActionToolCatalog(assistJson.postActionToolCatalog ?? []);
        setCanExecuteControlTowerPostActions(
          Boolean(assistJson.canExecuteControlTowerPostActions),
        );
        setPostActionHandlerCount(CONTROL_TOWER_POST_ACTION_HANDLER_COUNT);
        setAssistExecCatalog(assistJson.assistExecutablePostActionToolCatalog ?? []);
        setAssistExecutePath(assistJson.assistExecutePostActionPath ?? null);
      } else {
        setHints([]);
        setSuggested(null);
        setLlmAvailable(false);
        setUsedLlm(false);
        setAssistDocEmbeddings(false);
        setPostActionToolCatalog([]);
        setCanExecuteControlTowerPostActions(false);
        setPostActionHandlerCount(null);
        setAssistExecCatalog([]);
        setAssistExecutePath(null);
        const detail = assistJson.error?.trim() || assistRes.statusText || `HTTP ${assistRes.status}`;
        setAssistWarn(
          `Assist unavailable (${detail}). Search is using your raw query only — structured tokens were not applied.`,
        );
      }

      const filters = assistRes.ok ? (assistJson.suggestedFilters ?? {}) : {};
      const sp = new URLSearchParams();
      appendAssistToSearchParams(sp, filters, { take: 60 });
      mergeRawControlTowerSearchInput(sp, raw);
      if (!sp.toString()) {
        throw new Error("Enter search text or structured tokens (e.g. lane:, overdue).");
      }

      const searchRes = await fetch(`/api/control-tower/search?${sp.toString()}`);
      const data = (await searchRes.json()) as {
        shipments?: Hit[];
        error?: string;
        truncated?: boolean;
        searchLimit?: number;
      };
      if (!searchRes.ok) throw new Error(data.error || searchRes.statusText);
      setHits(data.shipments ?? []);
      setSearchTruncated(Boolean(data.truncated));
      setSearchLimit(typeof data.searchLimit === "number" ? data.searchLimit : null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
      setSearchTruncated(false);
      setSearchLimit(null);
    } finally {
      setBusy(false);
    }
  }, [q]);

  const structuredSummary = suggested && hasStructuredSearchInput(suggested) && (
    <p className="text-xs text-zinc-600">
      Structured:{" "}
      {[
        suggested.mode && `mode=${suggested.mode}`,
        suggested.status && `status=${suggested.status}`,
        suggested.onlyOverdueEta && "overdueEta",
        suggested.lane && `lane=${suggested.lane}`,
        suggested.supplierId && `supplierId=${suggested.supplierId.slice(0, 8)}…`,
        suggested.customerCrmAccountId && `customer=${suggested.customerCrmAccountId.slice(0, 8)}…`,
        suggested.carrierSupplierId && `carrier=${suggested.carrierSupplierId.slice(0, 8)}…`,
        suggested.originCode && `origin=${suggested.originCode}`,
        suggested.destinationCode && `dest=${suggested.destinationCode}`,
        suggested.routeAction && `routeAction=${suggested.routeAction}`,
        suggested.shipmentSource && `shipmentSource=${suggested.shipmentSource}`,
        suggested.dispatchOwnerUserId && `owner=${suggested.dispatchOwnerUserId.slice(0, 8)}…`,
        suggested.exceptionCode && `exceptionCode=${suggested.exceptionCode}`,
        suggested.alertType && `alertType=${suggested.alertType}`,
        suggested.productTraceQ && `productTrace=${suggested.productTraceQ}`,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="PO-…, docs, assignee, lane:CNSHA, route:plan_leg, overdue…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
        <button
          type="button"
          disabled={busy || !q.trim()}
          onClick={() => void run()}
          className="rounded-lg border border-arscmp-primary bg-arscmp-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Search
        </button>
      </div>
      {llmAvailable ? (
        <p className="text-xs text-zinc-600">
          This deployment merges OpenAI suggestions on top of rule-based filters for each search (see env:{" "}
          <code className="rounded bg-zinc-100 px-1">CONTROL_TOWER_ASSIST_LLM</code>).
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          OpenAI merge is off. Set <code className="rounded bg-zinc-100 px-1">OPENAI_API_KEY</code> and{" "}
          <code className="rounded bg-zinc-100 px-1">CONTROL_TOWER_ASSIST_LLM=1</code> to enable it.
        </p>
      )}
      {usedLlm ? (
        <p className="text-xs font-medium text-violet-800">Last search used AI-assisted filter merge.</p>
      ) : null}
      {assistDocEmbeddings ? (
        <p className="text-xs text-zinc-600">
          Assist doc hints used <strong>semantic</strong> retrieval over the Control Tower help corpus (env{" "}
          <code className="rounded bg-zinc-100 px-1">CONTROL_TOWER_ASSIST_EMBEDDINGS=1</code>).
        </p>
      ) : null}
      {structuredSummary}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={workbenchHref}
          className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium text-sky-900 hover:bg-sky-100"
        >
          Open same filters in Workbench →
        </Link>
        {productTraceHref ? (
          <Link
            href={productTraceHref}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-950 hover:bg-emerald-100"
          >
            Open product trace →
          </Link>
        ) : null}
      </div>
      {hints.length > 0 ? (
        <ul className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {hints.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      ) : null}
      {postActionToolCatalog.length > 0 && postActionHandlerCount != null ? (
        <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          <summary className="cursor-pointer font-medium text-zinc-800">
            Control Tower POST <code className="rounded bg-zinc-200 px-1">action</code> reference (
            {postActionToolCatalog.length} shown · {postActionHandlerCount} in router)
          </summary>
          <p className="mt-2 text-zinc-600">
            Mutations use <code className="rounded bg-zinc-100 px-1">POST /api/control-tower</code> with{" "}
            <code className="rounded bg-zinc-100 px-1">action</code> and payload — not this search. Your session:{" "}
            <span className="font-medium text-zinc-800">
              {canExecuteControlTowerPostActions
                ? "org.controltower → edit (can run actions in-app / API)"
                : "view only (see actions in 360; API POST requires edit)"}
            </span>
            .
          </p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
            {postActionToolCatalog.map((t) => (
              <li key={t.action}>
                <span className="text-[10px] font-semibold uppercase text-zinc-500">{t.group}</span>{" "}
                <code className="text-[11px] text-zinc-800">{t.action}</code> — {t.label}. {t.description}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {canExecuteControlTowerPostActions &&
      assistExecutePath &&
      assistExecCatalog.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-900">Step 1 — allowlisted action from Search</h3>
          <p className="mt-2 text-xs text-zinc-600">
            A tiny allowlist runs over <code className="rounded bg-zinc-100 px-1">POST {assistExecutePath}</code> with{" "}
            <code className="rounded bg-zinc-100 px-1">confirmed: true</code> (you must use the button below). Same audit
            rules as 360; an extra <code className="rounded bg-zinc-100 px-1">AssistPostAction</code> log links this run to
            your last search text.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs font-medium text-zinc-700">
              Action
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={execAction}
                onChange={(e) => setExecAction(e.target.value)}
              >
                {assistExecCatalog.map((t) => (
                  <option key={t.action} value={t.action}>
                    {t.label} ({t.action})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {execAction === "acknowledge_ct_alert" ? (
            <label className="mt-3 block text-xs font-medium text-zinc-700">
              Alert id (cuid)
              <input
                value={execAlertId}
                onChange={(e) => setExecAlertId(e.target.value)}
                placeholder="From Shipment 360 → open alert"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                autoComplete="off"
              />
            </label>
          ) : execAction === "bulk_acknowledge_ct_alerts" || execAction === "bulk_assign_ct_exception_owner" ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                Shipment ids (1–100; comma or line separated)
                <textarea
                  value={execBulkShipmentIdsText}
                  onChange={(e) => setExecBulkShipmentIdsText(e.target.value)}
                  rows={4}
                  placeholder="One shipment cuid per line or comma-separated"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                />
              </label>
              {execAction === "bulk_assign_ct_exception_owner" ? (
                <label className="block text-xs font-medium text-zinc-700">
                  Owner user id (cuid, leave empty to clear)
                  <input
                    value={execOwnerUserId}
                    onChange={(e) => setExecOwnerUserId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                    autoComplete="off"
                  />
                </label>
              ) : null}
            </div>
          ) : execAction === "assign_ct_exception_owner" ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                Exception id (cuid)
                <input
                  value={execExceptionId}
                  onChange={(e) => setExecExceptionId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Owner user id (cuid, leave empty to clear)
                <input
                  value={execOwnerUserId}
                  onChange={(e) => setExecOwnerUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                Shipment id (cuid)
                <input
                  value={execNoteShipmentId}
                  onChange={(e) => setExecNoteShipmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Note
                <textarea
                  value={execNoteBody}
                  onChange={(e) => setExecNoteBody(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={execNoteVisibility === "SHARED"}
                  onChange={(e) => setExecNoteVisibility(e.target.checked ? "SHARED" : "INTERNAL")}
                />
                Shared (otherwise internal)
              </label>
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              disabled={execBusy}
              onClick={() => void runAssistExecute()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {execBusy ? "Running…" : "Confirm and run action"}
            </button>
          </div>
          {execMessage ? <p className="mt-2 text-sm text-emerald-800">{execMessage}</p> : null}
          {execError ? <p className="mt-2 text-sm text-red-700">{execError}</p> : null}
        </section>
      ) : null}
      {assistWarn ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{assistWarn}</p>
      ) : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {searchTruncated && searchLimit != null ? (
        <p className="text-xs text-amber-900">
          Showing the first <strong>{searchLimit}</strong> matches for this query.{" "}
          <Link href={workbenchHref} className="font-medium text-sky-800 underline">
            Open in Workbench
          </Link>{" "}
          for the full scrollable list.
        </p>
      ) : null}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {hits.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
            {busy ? "Searching…" : "No results yet."}
          </li>
        ) : (
          hits.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-zinc-900">
                  {controlTowerListPrimaryTitle({
                    orderNumber: h.orderNumber,
                    shipmentNo: h.shipmentNo,
                    id: h.id,
                  })}
                </span>
                {(() => {
                  const sub = controlTowerListSecondaryRef({
                    orderNumber: h.orderNumber,
                    shipmentNo: h.shipmentNo,
                    id: h.id,
                  });
                  return sub ? <span className="text-xs text-zinc-600"> · {sub}</span> : null;
                })()}
                <span className="ml-2 text-xs text-zinc-500">
                  {h.status} · {h.transportMode || "—"}
                  {h.carrier ? ` · ${h.carrier}` : ""}
                </span>
                {h.originCode || h.destinationCode ? (
                  <div className="text-xs text-zinc-500">
                    {(h.originCode || "—") + " → " + (h.destinationCode || "—")}
                  </div>
                ) : null}
              </div>
              <Link href={`/control-tower/shipments/${h.id}`} className="text-sky-800 hover:underline">
                Open 360 →
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
