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

export type RoleCatalogEntry = { id: string; name: string; isSystem: boolean };

function roleIdsSignature(ids: string[]) {
  return [...ids].sort().join("\0");
}

export function SettingsUsersClient({
  users,
  roleCatalog,
}: {
  users: SettingsUserRow[];
  roleCatalog: RoleCatalogEntry[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() =>
    users.map((u) => ({ ...u, roles: u.roles.map((r) => ({ ...r })) })),
  );
  const [baseline, setBaseline] = useState(() =>
    Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          name: u.name,
          isActive: u.isActive,
          roleKey: roleIdsSignature(u.roles.map((r) => r.id)),
        },
      ]),
    ),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRow(
    id: string,
    patch: Partial<Pick<SettingsUserRow, "name" | "isActive" | "roles">>,
  ) {
    setRows((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
    setError(null);
  }

  function toggleUserRole(userId: string, roleId: string, checked: boolean) {
    setRows((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const set = new Set(u.roles.map((r) => r.id));
        if (checked) {
          const meta = roleCatalog.find((r) => r.id === roleId);
          if (!meta) return u;
          if (set.has(roleId)) return u;
          return {
            ...u,
            roles: [
              ...u.roles,
              { id: roleId, name: meta.name, isSystem: meta.isSystem },
            ],
          };
        }
        return {
          ...u,
          roles: u.roles.filter((r) => r.id !== roleId),
        };
      }),
    );
    setError(null);
  }

  async function saveRow(id: string) {
    const u = rows.find((r) => r.id === id);
    if (!u) return;
    const b = baseline[id];
    if (!b) return;

    const roleKey = roleIdsSignature(u.roles.map((r) => r.id));
    const payload: {
      name?: string;
      isActive?: boolean;
      roleIds?: string[];
    } = {};
    if (u.name.trim() !== b.name) payload.name = u.name.trim();
    if (u.isActive !== b.isActive) payload.isActive = u.isActive;
    if (roleKey !== b.roleKey) payload.roleIds = u.roles.map((r) => r.id);

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
      const roles = data.user.roles ?? [];
      setBaseline((prev) => ({
        ...prev,
        [id]: {
          name: data.user!.name,
          isActive: data.user!.isActive,
          roleKey: roleIdsSignature(roles.map((r) => r.id)),
        },
      }));
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                name: data.user!.name,
                isActive: data.user!.isActive,
                roles,
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
        <table className="w-full min-w-[720px] text-left text-sm">
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
              const roleKeyNow = roleIdsSignature(u.roles.map((r) => r.id));
              const dirty =
                !!b &&
                (u.name.trim() !== b.name ||
                  u.isActive !== b.isActive ||
                  roleKeyNow !== b.roleKey);
              const assigned = new Set(u.roles.map((r) => r.id));
              return (
                <tr key={u.id} className="text-zinc-800 align-top">
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
                    {roleCatalog.length === 0 ? (
                      <span className="text-xs text-zinc-400">No roles yet</span>
                    ) : (
                      <ul className="flex min-w-[12rem] flex-col gap-1.5">
                        {roleCatalog.map((r) => (
                          <li key={r.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                              <input
                                type="checkbox"
                                checked={assigned.has(r.id)}
                                onChange={(e) =>
                                  toggleUserRole(u.id, r.id, e.target.checked)
                                }
                                className="rounded border-zinc-300"
                              />
                              {r.name}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
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
        Email and sign-in are not managed in this demo. Use{" "}
        <strong>Save</strong> after changing name, roles, or active status.
      </p>
    </div>
  );
}
