"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SessionUser = { email: string; name: string; isActive: boolean };

export function DemoUserSwitcher() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAccess, setOpenAccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/demo-session", { credentials: "include" });
    const data = (await res.json()) as {
      users?: SessionUser[];
      current?: string;
      openAccess?: boolean;
    };
    if (res.ok && data.users) {
      setUsers(data.users);
      setCurrent(data.current ?? "");
      setOpenAccess(Boolean(data.openAccess));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  async function onSelect(email: string) {
    if (!email || email === current) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/demo-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? `Switch failed (${res.status})`);
      return;
    }
    setCurrent(email);
    // Full reload so layouts/pages pick up the new httpOnly cookie reliably on Vercel.
    window.location.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  const actives = users.filter((u) => u.isActive);

  return (
    <div className="border-b border-zinc-200 bg-amber-50/80 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium">Demo user</span>
        {loading ? (
          <span className="text-amber-800/80">Loading…</span>
        ) : (
          <label className="flex items-center gap-2">
            <span className="sr-only">Act as user</span>
            <select
              value={current}
              disabled={saving}
              onChange={(e) => void onSelect(e.target.value)}
              className="h-8 min-w-[14rem] rounded border border-amber-200/80 bg-white px-2 text-sm text-zinc-900"
            >
              {actives.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {saving ? (
              <span className="text-xs text-amber-800">Switching…</span>
            ) : null}
            {error ? (
              <span className="text-xs font-medium text-red-700">{error}</span>
            ) : null}
          </label>
        )}
        <span className="text-xs text-amber-900/80">
          {openAccess ? (
            <>
              Roles drive permissions. Pick a user above — no password required. Optional:{" "}
              <Link href="/login" className="underline">
                /login
              </Link>{" "}
              (buyer@ or approver@ + <span className="font-mono">demo12345</span>).
            </>
          ) : (
            <>
              Roles drive permissions. You can also use real sign-in at{" "}
              <Link href="/login" className="underline">
                /login
              </Link>
              .
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => void logout()}
          className="ml-auto rounded border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900"
        >
          {openAccess ? "Clear session" : "Logout"}
        </button>
      </div>
    </div>
  );
}
