"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SettingsUserRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string; isSystem: boolean }[];
  primaryOrgUnitId: string | null;
  primaryOrgUnit: { id: string; name: string; code: string; kind: string } | null;
  productDivisions: { id: string; name: string; code: string | null }[];
};

export type RoleCatalogEntry = { id: string; name: string; isSystem: boolean };

export type OrgUnitOption = { id: string; name: string; code: string; kind: string };
export type ProductDivisionOption = { id: string; name: string; code: string | null };

function roleIdsSignature(ids: string[]) {
  return [...ids].sort().join("\0");
}

function userFromPatchResponse(data: unknown): {
  name: string;
  isActive: boolean;
  roles: SettingsUserRow["roles"];
  primaryOrgUnitId: string | null;
  primaryOrgUnit: SettingsUserRow["primaryOrgUnit"];
  productDivisions: SettingsUserRow["productDivisions"];
} | null {
  const body = data as {
    user?: {
      name: string;
      isActive: boolean;
      roles: SettingsUserRow["roles"];
      primaryOrgUnitId?: string | null;
      primaryOrgUnit?: SettingsUserRow["primaryOrgUnit"];
      productDivisions?: SettingsUserRow["productDivisions"];
    };
  };
  if (!body.user) return null;
  return {
    name: body.user.name,
    isActive: body.user.isActive,
    roles: body.user.roles ?? [],
    primaryOrgUnitId: body.user.primaryOrgUnitId ?? null,
    primaryOrgUnit: body.user.primaryOrgUnit ?? null,
    productDivisions: body.user.productDivisions ?? [],
  };
}

export function SettingsUsersClient({
  users,
  roleCatalog,
  orgUnits,
  productDivisionCatalog,
  canEdit,
  actorUserId,
}: {
  users: SettingsUserRow[];
  roleCatalog: RoleCatalogEntry[];
  orgUnits: OrgUnitOption[];
  productDivisionCatalog: ProductDivisionOption[];
  canEdit: boolean;
  actorUserId: string | null;
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
          primaryOrgUnitId: u.primaryOrgUnitId,
          productDivisionKey: roleIdsSignature(u.productDivisions.map((d) => d.id)),
        },
      ]),
    ),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoleIds, setCreateRoleIds] = useState<Set<string>>(() => new Set());
  const [createPrimaryOrgId, setCreatePrimaryOrgId] = useState<string>("");
  const [createProductDivIds, setCreateProductDivIds] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState(false);

  const isSelf = (id: string) => actorUserId != null && id === actorUserId;

  function updateRow(
    id: string,
    patch: Partial<
      Pick<
        SettingsUserRow,
        | "name"
        | "isActive"
        | "roles"
        | "primaryOrgUnitId"
        | "primaryOrgUnit"
        | "productDivisions"
      >
    >,
  ) {
    setRows((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
    setError(null);
  }

  function toggleUserRole(userId: string, roleId: string, checked: boolean) {
    if (!canEdit) return;
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

  function toggleCreateRole(roleId: string, checked: boolean) {
    setCreateRoleIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
    setError(null);
  }

  function toggleUserProductDivision(userId: string, divisionId: string, checked: boolean) {
    if (!canEdit) return;
    setRows((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const set = new Set(u.productDivisions.map((d) => d.id));
        if (checked) {
          const meta = productDivisionCatalog.find((d) => d.id === divisionId);
          if (!meta) return u;
          if (set.has(divisionId)) return u;
          return {
            ...u,
            productDivisions: [
              ...u.productDivisions,
              { id: meta.id, name: meta.name, code: meta.code },
            ],
          };
        }
        return {
          ...u,
          productDivisions: u.productDivisions.filter((d) => d.id !== divisionId),
        };
      }),
    );
    setError(null);
  }

  function toggleCreateProductDiv(divisionId: string, checked: boolean) {
    setCreateProductDivIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(divisionId);
      else next.delete(divisionId);
      return next;
    });
    setError(null);
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      return { ok: false as const, data };
    }
    const u = userFromPatchResponse(data);
    if (u) {
      setBaseline((prev) => ({
        ...prev,
        [id]: {
          name: u.name,
          isActive: u.isActive,
          roleKey: roleIdsSignature(u.roles.map((r) => r.id)),
          primaryOrgUnitId: u.primaryOrgUnitId,
          productDivisionKey: roleIdsSignature(u.productDivisions.map((d) => d.id)),
        },
      }));
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                name: u.name,
                isActive: u.isActive,
                roles: u.roles,
                primaryOrgUnitId: u.primaryOrgUnitId,
                primaryOrgUnit: u.primaryOrgUnit,
                productDivisions: u.productDivisions,
              }
            : r,
        ),
      );
    }
    return { ok: true as const, data };
  }

  async function saveRow(id: string) {
    if (!canEdit) return;
    const u = rows.find((r) => r.id === id);
    if (!u) return;
    const b = baseline[id];
    if (!b) return;

    const roleKey = roleIdsSignature(u.roles.map((r) => r.id));
    const divKey = roleIdsSignature(u.productDivisions.map((d) => d.id));
    const payload: {
      name?: string;
      isActive?: boolean;
      roleIds?: string[];
      primaryOrgUnitId?: string | null;
      productDivisionIds?: string[];
    } = {};
    if (u.name.trim() !== b.name) payload.name = u.name.trim();
    if (u.isActive !== b.isActive) {
      if (!u.isActive && isSelf(id)) {
        setError("You cannot deactivate your own account.");
        return;
      }
      payload.isActive = u.isActive;
    }
    if (roleKey !== b.roleKey) payload.roleIds = u.roles.map((r) => r.id);
    if (u.primaryOrgUnitId !== b.primaryOrgUnitId) {
      payload.primaryOrgUnitId = u.primaryOrgUnitId;
    }
    if (divKey !== b.productDivisionKey) {
      payload.productDivisionIds = u.productDivisions.map((d) => d.id);
    }

    if (Object.keys(payload).length === 0) return;

    setSavingId(id);
    setError(null);
    const result = await patchUser(id, payload);
    setSavingId(null);
    if (!result.ok) {
      setError(apiClientErrorMessage(result.data, "Save failed."));
      return;
    }
    router.refresh();
  }

  async function setActiveOneClick(id: string, next: boolean) {
    if (!canEdit) return;
    if (!next && isSelf(id)) {
      setError("You cannot deactivate your own account.");
      return;
    }
    setSavingId(id);
    setError(null);
    const result = await patchUser(id, { isActive: next });
    setSavingId(null);
    if (!result.ok) {
      setError(apiClientErrorMessage(result.data, "Update failed."));
      return;
    }
    router.refresh();
  }

  async function createUser() {
    if (!canEdit) return;
    setError(null);
    setCreating(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: createEmail,
        name: createName,
        password: createPassword,
        roleIds: [...createRoleIds],
        ...(createPrimaryOrgId ? { primaryOrgUnitId: createPrimaryOrgId } : {}),
        productDivisionIds: [...createProductDivIds],
      }),
    });
    const data: unknown = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(data ?? {}, "Create user failed."));
      return;
    }
    setCreateEmail("");
    setCreateName("");
    setCreatePassword("");
    setCreateRoleIds(new Set());
    setCreatePrimaryOrgId("");
    setCreateProductDivIds(new Set());
    router.refresh();
  }

  async function setPassword(id: string) {
    if (!canEdit) return;
    const password = window.prompt("Set a new password (min 8 chars):", "");
    if (!password) return;
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data: unknown = await res.json().catch(() => null);
    setSavingId(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(data ?? {}, "Password update failed."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          View only: you have Settings → view but not → edit. Ask an admin to grant{" "}
          <span className="whitespace-nowrap">org.settings → edit</span> to create or change users.
        </p>
      ) : null}

      {canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Create user</h3>
          <p className="mt-1 text-xs text-zinc-600">
            New users receive the initial password below; they can change it after sign-in.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              className="h-9 rounded-xl border border-zinc-300 px-2 text-sm"
            />
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Full name"
              className="h-9 rounded-xl border border-zinc-300 px-2 text-sm"
            />
            <input
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder="Initial password (min 8)"
              className="h-9 rounded-xl border border-zinc-300 px-2 text-sm"
            />
            <button
              type="button"
              disabled={creating}
              onClick={() => void createUser()}
              className="h-9 rounded-xl bg-[var(--arscmp-primary)] px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create user"}
            </button>
          </div>
          {roleCatalog.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-700">Initial roles (optional)</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {roleCatalog.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                      <input
                        type="checkbox"
                        checked={createRoleIds.has(r.id)}
                        onChange={(e) => toggleCreateRole(r.id, e.target.checked)}
                        className="rounded border-zinc-300"
                      />
                      {r.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {orgUnits.length > 0 ? (
            <label className="mt-4 block text-xs font-medium text-zinc-700">
              Primary org (optional)
              <select
                className="mt-1 w-full max-w-md rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={createPrimaryOrgId}
                onChange={(e) => setCreatePrimaryOrgId(e.target.value)}
              >
                <option value="">— None —</option>
                {orgUnits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {productDivisionCatalog.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-zinc-700">Product division scope (optional matrix)</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {productDivisionCatalog.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                      <input
                        type="checkbox"
                        checked={createProductDivIds.has(d.id)}
                        onChange={(e) => toggleCreateProductDiv(d.id, e.target.checked)}
                        className="rounded border-zinc-300"
                      />
                      {d.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Primary org</th>
              <th className="px-3 py-2 font-medium">Product divisions</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((u) => {
              const b = baseline[u.id];
              const roleKeyNow = roleIdsSignature(u.roles.map((r) => r.id));
              const divKeyNow = roleIdsSignature(u.productDivisions.map((d) => d.id));
              const dirty =
                canEdit &&
                !!b &&
                (u.name.trim() !== b.name ||
                  u.isActive !== b.isActive ||
                  roleKeyNow !== b.roleKey ||
                  u.primaryOrgUnitId !== b.primaryOrgUnitId ||
                  divKeyNow !== b.productDivisionKey);
              const assigned = new Set(u.roles.map((r) => r.id));
              const divAssigned = new Set(u.productDivisions.map((d) => d.id));
              const selfRow = isSelf(u.id);
              return (
                <tr
                  key={u.id}
                  className={`text-zinc-800 align-top ${!u.isActive ? "bg-zinc-50/80" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                    {u.email}
                    {selfRow ? (
                      <span className="ml-1 text-[10px] font-sans font-normal text-zinc-500">
                        (you)
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        value={u.name}
                        onChange={(e) => updateRow(u.id, { name: e.target.value })}
                        className="h-8 w-full min-w-[10rem] rounded-xl border border-zinc-300 px-2 text-sm"
                        maxLength={120}
                      />
                    ) : (
                      <span>{u.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-[11rem]">
                    {orgUnits.length === 0 ? (
                      <span className="text-xs text-zinc-400">Define org under Settings → Org &amp; sites</span>
                    ) : canEdit ? (
                      <select
                        className="h-8 w-full max-w-[14rem] rounded-xl border border-zinc-300 px-2 text-xs"
                        value={u.primaryOrgUnitId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          const ou = v ? orgUnits.find((x) => x.id === v) : null;
                          updateRow(u.id, {
                            primaryOrgUnitId: v,
                            primaryOrgUnit: ou
                              ? {
                                  id: ou.id,
                                  name: ou.name,
                                  code: ou.code,
                                  kind: ou.kind,
                                }
                              : null,
                          });
                        }}
                      >
                        <option value="">— None —</option>
                        {orgUnits.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} ({o.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-zinc-700">
                        {u.primaryOrgUnit ? `${u.primaryOrgUnit.name} (${u.primaryOrgUnit.code})` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-[9rem]">
                    {productDivisionCatalog.length === 0 ? (
                      <span className="text-xs text-zinc-400">—</span>
                    ) : canEdit ? (
                      <ul className="flex flex-col gap-1">
                        {productDivisionCatalog.map((d) => (
                          <li key={d.id}>
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-800">
                              <input
                                type="checkbox"
                                checked={divAssigned.has(d.id)}
                                onChange={(e) =>
                                  toggleUserProductDivision(u.id, d.id, e.target.checked)
                                }
                                className="rounded border-zinc-300"
                              />
                              {d.name}
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-zinc-700">
                        {u.productDivisions.length
                          ? u.productDivisions.map((d) => d.name).join(", ")
                          : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {roleCatalog.length === 0 ? (
                      <span className="text-xs text-zinc-400">No roles yet</span>
                    ) : canEdit ? (
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
                    ) : (
                      <span className="text-xs text-zinc-700">
                        {u.roles.length ? u.roles.map((r) => r.name).join(", ") : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <span
                        className={
                          u.isActive
                            ? "inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : "inline-flex w-fit rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700"
                        }
                      >
                        {u.isActive ? "Active" : "Deactivated"}
                      </span>
                      {canEdit ? (
                        <div className="flex flex-wrap gap-1.5">
                          {!u.isActive ? (
                            <button
                              type="button"
                              disabled={savingId === u.id}
                              onClick={() => void setActiveOneClick(u.id, true)}
                              className="rounded-lg border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-800 disabled:opacity-40"
                            >
                              Activate
                            </button>
                          ) : !selfRow ? (
                            <button
                              type="button"
                              disabled={savingId === u.id}
                              onClick={() => void setActiveOneClick(u.id, false)}
                              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-500">Cannot deactivate self</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={savingId === u.id}
                          onClick={() => void setPassword(u.id)}
                          className="h-8 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 disabled:opacity-40"
                        >
                          Password
                        </button>
                        <button
                          type="button"
                          disabled={!dirty || savingId === u.id}
                          onClick={() => void saveRow(u.id)}
                          className="h-8 rounded-xl border border-[var(--arscmp-primary)] bg-[var(--arscmp-primary)] px-3 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {savingId === u.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <p className="text-xs text-zinc-500">
          Define the org tree under <strong>Settings → Org &amp; sites</strong>. Click <strong>Save</strong>{" "}
          after changing name, org, product divisions, or roles. <strong>Activate</strong> /{" "}
          <strong>Deactivate</strong> and <strong>Password</strong> apply immediately to status / credentials.
        </p>
      ) : null}
    </div>
  );
}
