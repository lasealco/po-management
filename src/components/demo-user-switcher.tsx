"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SessionUser = { email: string; name: string; isActive: boolean };

export function DemoUserSwitcher() {
  const router = useRouter();
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/demo-session");
    const data = (await res.json()) as {
      users?: SessionUser[];
      current?: string;
    };
    if (res.ok && data.users) {
      setUsers(data.users);
      setCurrent(data.current ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSelect(email: string) {
    if (!email || email === current) return;
    setSaving(true);
    const res = await fetch("/api/demo-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSaving(false);
    if (!res.ok) return;
    setCurrent(email);
    router.refresh();
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
          </label>
        )}
        <span className="text-xs text-amber-900/80">
          Permissions use roles for this user. Not real authentication.
        </span>
      </div>
    </div>
  );
}
