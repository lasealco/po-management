"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { SearchableSelectField } from "@/components/searchable-select-field";

import {
  groupCatalogByResource,
  type GlobalPermissionRow,
} from "@/lib/permission-catalog";

type RoleOption = { id: string; name: string };

type CatalogRow = GlobalPermissionRow & { granted: boolean };

function grantsKey(rows: CatalogRow[]) {
  return rows
    .filter((r) => r.granted)
    .map((r) => `${r.resource}\0${r.action}`)
    .sort()
    .join("|");
}

export function SettingsPermissionsClient({
  roles,
}: {
  roles: RoleOption[];
}) {
  const router = useRouter();
  const grouped = groupCatalogByResource();
  const resourceOrder = [...grouped.keys()];

  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baselineKey, setBaselineKey] = useState<string>("");
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles],
  );

  const load = useCallback(async (rid: string) => {
    if (!rid) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/roles/${rid}/permissions`);
    const data = (await res.json()) as {
      catalog?: CatalogRow[];
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setCatalog(null);
      setError(data.error ?? "Failed to load permissions.");
      return;
    }
    if (data.catalog) {
      setCatalog(data.catalog);
      setBaselineKey(grantsKey(data.catalog));
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void load(roleId);
    });
  }, [roleId, load]);

  function toggle(resource: string, action: string, checked: boolean) {
    setCatalog((prev) => {
      if (!prev) return prev;
      return prev.map((r) =>
        r.resource === resource && r.action === action
          ? { ...r, granted: checked }
          : r,
      );
    });
    setError(null);
  }

  async function save() {
    if (!catalog || !roleId) return;
    const grants = catalog
      .filter((r) => r.granted)
      .map((r) => ({ resource: r.resource, action: r.action }));

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/roles/${roleId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grants }),
    });
    const data = (await res.json()) as { catalog?: CatalogRow[]; error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed.");
      return;
    }
    if (data.catalog) {
      setCatalog(data.catalog);
      setBaselineKey(grantsKey(data.catalog));
    }
    router.refresh();
  }

  const dirty =
    catalog !== null && baselineKey !== "" && grantsKey(catalog) !== baselineKey;

  if (roles.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Create roles first (run db:seed), then assign permissions here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">Role</span>
          <SearchableSelectField
            value={roleId}
            onChange={setRoleId}
            options={roleOptions}
            placeholder="Type to filter role..."
            emptyLabel="Select role..."
            inputClassName="h-9 min-w-[12rem] rounded border border-zinc-300 px-2 text-sm"
            listClassName="max-h-36 overflow-auto rounded border border-zinc-200 bg-white"
          />
        </label>
        <button
          type="button"
          disabled={!dirty || saving || loading}
          onClick={() => void save()}
          className="h-9 rounded border border-zinc-900 bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save permissions"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {loading || !catalog ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-8">
          <p className="text-xs text-zinc-500">
            Global rules only (not per workflow status). Unchecked means no
            explicit allow row; enforcement in the app can be wired to this
            catalog over time.
          </p>
          {resourceOrder.map((resource) => {
            const rows = grouped.get(resource) ?? [];
            return (
              <section key={resource}>
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {resource}
                </h3>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                  {rows.map((row) => {
                    const live = catalog.find(
                      (c) =>
                        c.resource === row.resource && c.action === row.action,
                    );
                    const granted = live?.granted ?? false;
                    return (
                      <li
                        key={`${row.resource}:${row.action}`}
                        className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-start sm:gap-6"
                      >
                        <label className="flex shrink-0 cursor-pointer items-start gap-2 sm:min-w-[200px]">
                          <input
                            type="checkbox"
                            checked={granted}
                            onChange={(e) =>
                              toggle(
                                row.resource,
                                row.action,
                                e.target.checked,
                              )
                            }
                            className="mt-0.5 rounded border-zinc-300"
                          />
                          <span>
                            <span className="font-medium text-zinc-900">
                              {row.label}
                            </span>
                            <span className="ml-2 font-mono text-xs text-zinc-500">
                              {row.action}
                            </span>
                          </span>
                        </label>
                        <p className="text-xs text-zinc-600 sm:pt-0.5">
                          {row.description}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
