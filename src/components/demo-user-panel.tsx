"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { startTransition, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SessionUser = { email: string; name: string; isActive: boolean };

export function DemoUserPanel({ className = "" }: { className?: string }) {
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
      const data: unknown = await res.json().catch(() => null);
      setError(apiClientErrorMessage(data ?? {}, `Switch failed (${res.status})`));
      return;
    }
    setCurrent(email);
    window.location.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  const actives = users.filter((u) => u.isActive);

  return (
    <section
      className={`rounded-xl border border-amber-200/90 bg-amber-50/95 p-5 text-sm text-amber-950 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="font-semibold text-amber-950">Demo user</span>
        {loading ? (
          <span className="text-amber-800/80">Loading…</span>
        ) : (
          <label className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
            <span className="sr-only">Act as user</span>
            <select
              value={current}
              disabled={saving}
              onChange={(e) => void onSelect(e.target.value)}
              className="h-9 min-w-[12rem] max-w-full flex-1 rounded-md border border-amber-300/90 bg-white px-2 text-sm text-zinc-900 shadow-sm"
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
        <button
          type="button"
          onClick={() => void logout()}
          className="ml-auto shrink-0 rounded-md border border-amber-400/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 shadow-sm hover:bg-amber-50"
        >
          {openAccess ? "Clear session" : "Logout"}
        </button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-amber-900/85">
        {openAccess ? (
          <>
            Roles drive permissions. Pick a user above — no password required. Optional:{" "}
            <Link href="/login" className="font-medium underline underline-offset-2">
              /login
            </Link>{" "}
            (buyer@ / approver@ + <span className="font-mono">demo12345</span>, or{" "}
            <span className="font-mono">superuser@arscmp.com</span> + <span className="font-mono">superuser</span>).
            Superuser has broad module grants; deeper org-scoped RBAC is roadmap — see repo{" "}
            <span className="font-mono">docs/engineering/USER_ROLES_AND_RBAC.md</span>.
          </>
        ) : (
          <>
            Roles drive permissions. You can also use real sign-in at{" "}
            <Link href="/login" className="font-medium underline underline-offset-2">
              /login
            </Link>
            .
          </>
        )}
      </p>
    </section>
  );
}
