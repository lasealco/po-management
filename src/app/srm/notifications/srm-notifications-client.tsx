"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  supplierId: string | null;
  taskId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export function SrmNotificationsClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadFilter, setUnreadFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const q = unreadFilter ? "?unread=1" : "";
    const res = await fetch(`/api/srm/notifications${q}`);
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Could not load notifications."));
      return;
    }
    const p = payload as { notifications?: Row[]; unreadCount?: number };
    setRows(Array.isArray(p.notifications) ? p.notifications : []);
    setUnreadCount(typeof p.unreadCount === "number" ? p.unreadCount : 0);
  }, [unreadFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function markRead(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/srm/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    const payload: unknown = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Update failed."));
      return;
    }
    await load();
  }

  async function markAllRead() {
    setMarkAllBusy(true);
    setError(null);
    const res = await fetch("/api/srm/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    const payload: unknown = await res.json().catch(() => null);
    setMarkAllBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Update failed."));
      return;
    }
    await load();
  }

  if (rows === null) {
    return <p className="text-sm text-zinc-600">Loading…</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600">
          {unreadCount > 0 ? (
            <span>
              <strong className="text-zinc-900">{unreadCount}</strong> unread
            </span>
          ) : (
            "No unread items."
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              checked={unreadFilter}
              onChange={(e) => setUnreadFilter(e.target.checked)}
            />
            <span>Unread only</span>
          </label>
          <button
            type="button"
            disabled={unreadCount === 0 || markAllBusy}
            onClick={() => void markAllRead()}
            className="rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markAllBusy ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>
      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No notifications yet. Assigning an onboarding task to a teammate creates one (Phase G).</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-100 border border-zinc-200 rounded-lg bg-white">
          {rows.map((n) => (
            <li key={n.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={`text-sm font-medium ${n.readAt ? "text-zinc-500" : "text-zinc-900"}`}>{n.title}</p>
                {n.body ? <p className="mt-1 text-xs text-zinc-600">{n.body}</p> : null}
                <p className="mt-2 text-xs text-zinc-400">
                  {new Date(n.createdAt).toLocaleString()}
                  {n.kind ? ` · ${n.kind}` : ""}
                  {n.actorName ? ` · From ${n.actorName}` : ""}
                </p>
                {n.supplierId ? (
                  <Link
                    href={`/srm/${n.supplierId}?tab=onboarding`}
                    className="mt-2 inline-block text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                  >
                    Open supplier
                  </Link>
                ) : null}
              </div>
              {!n.readAt ? (
                <button
                  type="button"
                  disabled={busy === n.id}
                  onClick={() => void markRead(n.id)}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Mark read
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
