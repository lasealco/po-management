"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { AssistantInboxItem, AssistantInboxPayload } from "@/lib/assistant/inbox-aggregate";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const KIND_LABEL: Record<AssistantInboxItem["kind"], string> = {
  ct_alert: "Open alert",
  ct_exception: "Exception",
  so_draft: "Draft sales order",
  email_thread: "Email (pilot)",
};

function kindStyle(kind: AssistantInboxItem["kind"]): string {
  if (kind === "ct_alert") return "border-amber-200 bg-amber-50 text-amber-950";
  if (kind === "ct_exception") return "border-rose-200 bg-rose-50 text-rose-950";
  if (kind === "email_thread") return "border-violet-200 bg-violet-50 text-violet-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

export function AssistantInboxClient({
  canAckAlert,
  canCreateSalesOrder,
}: {
  canAckAlert: boolean;
  canCreateSalesOrder: boolean;
}) {
  const [data, setData] = useState<AssistantInboxPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/assistant/inbox");
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & AssistantInboxPayload;
      if (!res.ok) {
        setErr(j.error || "Could not load inbox.");
        return;
      }
      setData({
        items: j.items ?? [],
        total: j.total ?? 0,
        producers: j.producers ?? { ctAlerts: false, ctExceptions: false, soDrafts: false },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load inbox.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const acknowledge = async (alertId: string) => {
    if (!canAckAlert) {
      window.alert("You need org.controltower → edit to acknowledge alerts from here.");
      return;
    }
    if (!window.confirm("Acknowledge this alert? It will move to acknowledged in Control Tower.")) {
      return;
    }
    setAckBusy(alertId);
    setErr(null);
    try {
      const res = await fetch("/api/control-tower", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_ct_alert", alertId }),
      });
      const parsed: unknown = await res.json();
      if (!res.ok) {
        setErr(apiClientErrorMessage(parsed, "Could not acknowledge alert."));
        return;
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setAckBusy(null);
    }
  };

  if (busy && !data) {
    return <p className="text-sm text-zinc-600">Loading open items…</p>;
  }

  const items = data?.items ?? [];
  const producers = data?.producers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          {producers ? (
            <>
              Showing:{" "}
              {[
                producers.ctAlerts ? "alerts" : null,
                producers.ctExceptions ? "exceptions" : null,
                producers.soDrafts ? "SO drafts" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>
      {err ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p> : null}
      {items.length === 0 && !busy ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">You’re all caught up</p>
          <p className="mt-1">
            No open alerts, no open exceptions, no open email (pilot), and no draft sales orders in scope — or your
            tenant is empty.
          </p>
          <p className="mt-3">
            <Link className="font-medium text-[var(--arscmp-primary)] hover:underline" href="/assistant">
              Go to Chat
            </Link>{" "}
            to create a sales order from natural language.
          </p>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((row) => (
          <li
            key={row.id}
            className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${kindStyle(
              row.kind,
            )}`}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{KIND_LABEL[row.kind]}</p>
              <p className="mt-0.5 font-medium text-zinc-900">{row.title}</p>
              {row.subtitle ? <p className="mt-0.5 text-xs text-zinc-700">{row.subtitle}</p> : null}
              <p className="mt-1 text-[11px] text-zinc-500">
                {new Date(row.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              {row.suggestedAction ? (
                <div className="mt-3 rounded-xl border border-white/70 bg-white/70 p-3 text-xs text-zinc-700">
                  <p className="font-semibold text-zinc-900">Suggested next action</p>
                  <p className="mt-1 font-medium">{row.suggestedAction.label}</p>
                  <p className="mt-1 text-zinc-600">{row.suggestedAction.description}</p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={row.href}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
              >
                Open
              </Link>
              {row.suggestedAction ? (
                <Link
                  href={row.suggestedAction.href}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  Start action
                </Link>
              ) : null}
              {row.kind === "ct_alert" && row.alertId ? (
                <button
                  type="button"
                  disabled={!canAckAlert || ackBusy === row.alertId}
                  onClick={() => void acknowledge(row.alertId!)}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ackBusy === row.alertId ? "…" : "Acknowledge"}
                </button>
              ) : null}
              {row.kind === "so_draft" && !canCreateSalesOrder ? (
                <span className="self-center text-[11px] text-zinc-600">View-only (need edit to change SO)</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
