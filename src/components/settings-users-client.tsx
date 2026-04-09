"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type SettingsUserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string; isSystem: boolean }[];
};

export function SettingsUsersClient({ users }: { users: SettingsUserRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    users.map((u) => ({ ...u, roles: u.roles.map((r) => ({ ...r })) })),
  );
  const [baseline, setBaseline] = useState<Record<string, { name: string; isActive: boolean }>>(
    () =>
      Object.fromEntries(
        users.map((u) => [u.id, { name: u.name, isActive: u.isActive }]),
      ),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<Pick<SettingsUserRow, "name" | "isActive">>) {
    setRows((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
    setError(null);
  }

  async function saveRow(id: string) {
    const u = rows.find((r) => r.id === id);
    if (!u) return;
    const b = baseline[id];
    if (!b) return;

    const payload: { name?: string; isActive?: boolean } = {};
    if (u.name.trim() !== b.name) payload.name = u.name.trim();
    if (u.isActive !== b.isActive) payload.isActive = u.isActive;
    if (Object.keys(payload).length === 0) return;

    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      user?: {
        id: string;
        name: string;
        isActive: boolean;
        roles: SettingsUserRow["roles"];
      };
      error?: string;
    };
    setSavingId(null);
    if (!res.ok) {
      setError(data.error ?? "Save failed.");
      return;
    }
    if (data.user) {
      setBaseline((prev) => ({
        ...prev,
        [id]: { name: data.user!.name, isActive: data.user!.isActive },
      }));
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                name: data.user!.name,
                isActive: data.user!.isActive,
                roles: data.user!.roles ?? r.roles,
              }
            : r,
        ),
      );
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((u) => {
              const b = baseline[u.id];
              const dirty =
                !!b &&
                (u.name.trim() !== b.name || u.isActive !== b.isActive);
              return (
                <tr key={u.id} className="text-zinc-800">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                    {u.email}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={u.name}
                      onChange={(e) => updateRow(u.id, { name: e.target.value })}
                      className="h-8 w-full min-w-[10rem] rounded border border-zinc-300 px-2 text-sm"
                      maxLength={120}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ul className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <li className="text-xs text-zinc-400">—</li>
                      ) : (
                        u.roles.map((r) => (
                          <li
                            key={r.id}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700"
                          >
                            {r.name}
                          </li>
                        ))
                      )}
                    </ul>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={u.isActive}
                      onChange={(e) =>
                        updateRow(u.id, { isActive: e.target.checked })
                      }
                      className="rounded border-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!dirty || savingId === u.id}
                      onClick={() => void saveRow(u.id)}
                      className="h-8 rounded border border-zinc-900 bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-40"
                    >
                      {savingId === u.id ? "Saving…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Role membership is read-only here for now; use seed data or a future
        assignment UI. Email and sign-in are not managed in this demo.
      </p>
    </div>
  );
}
