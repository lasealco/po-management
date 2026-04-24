"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { OrgUnitKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { buildOrgUnitTree, type OrgUnitTreeRow } from "@/lib/org-unit";

const KIND_OPTIONS: { value: OrgUnitKind; label: string }[] = [
  { value: "GROUP", label: "Group / global HQ" },
  { value: "LEGAL_ENTITY", label: "Legal entity / subsidiary" },
  { value: "REGION", label: "Region" },
  { value: "COUNTRY", label: "Country" },
  { value: "SITE", label: "Site / plant" },
  { value: "OFFICE", label: "Office" },
];

type FlatRow = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  kind: OrgUnitKind;
  sortOrder: number;
};

export function SettingsOrgStructureClient({
  canEdit,
  initialTree,
  allFlat,
}: {
  canEdit: boolean;
  initialTree: OrgUnitTreeRow[];
  allFlat: FlatRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    kind: "REGION" as OrgUnitKind,
    parentId: "" as string,
    sortOrder: 0,
  });

  const parentSelectRows = useMemo(() => {
    const t = buildOrgUnitTree(allFlat);
    return t.map((r) => ({
      id: r.id,
      label: `${"\u00A0\u00A0".repeat(r.depth)}${r.depth ? "" : ""}${r.name} (${r.code})`,
    }));
  }, [allFlat]);

  async function createUnit() {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/org-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        code: form.code,
        kind: form.kind,
        parentId: form.parentId || null,
        sortOrder: form.sortOrder,
      }),
    });
    const data: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(data, "Create failed."));
      return;
    }
    setForm({ name: "", code: "", kind: "REGION", parentId: "", sortOrder: 0 });
    router.refresh();
  }

  async function updateUnit(
    id: string,
    patch: { name?: string; code?: string; kind?: OrgUnitKind; parentId?: string | null; sortOrder?: number },
  ) {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/org-units/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(data, "Update failed."));
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function removeUnit(id: string) {
    if (!canEdit) return;
    if (!window.confirm("Delete this org unit? Child units and users must be moved first.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/org-units/${id}`, { method: "DELETE" });
    const data: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(data, "Delete failed."));
      return;
    }
    router.refresh();
  }

  const editing = editingId ? allFlat.find((o) => o.id === editingId) : null;

  return (
    <div className="space-y-6">
      {!canEdit ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          View only: you need <span className="whitespace-nowrap">org.settings → edit</span> to
          change org structure.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Add org unit</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Code is a stable key (e.g. APAC, US, DE) — unique per company. It appears in user
            assignment dropdowns.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col text-xs">
              <span className="text-zinc-600">Parent</span>
              <select
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                disabled={busy}
              >
                <option value="">(root level)</option>
                {parentSelectRows.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs sm:col-span-2">
              <span className="text-zinc-600">Display name</span>
              <input
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. EMEA / Germany / Munich Plant"
                disabled={busy}
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="text-zinc-600">Code</span>
              <input
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="EMEA, DE, …"
                disabled={busy}
              />
            </label>
            <label className="flex flex-col text-xs sm:col-span-2">
              <span className="text-zinc-600">Type</span>
              <select
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as OrgUnitKind }))
                }
                disabled={busy}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={busy || !form.name.trim() || !form.code.trim()}
                onClick={() => void createUnit()}
                className="h-[42px] w-full rounded-xl bg-[var(--arscmp-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "…" : "Add"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Org unit</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {initialTree.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                  No org units yet. Add a global or regional node to start.
                </td>
              </tr>
            ) : null}
            {initialTree.map((r) => (
              <tr key={r.id} className="text-zinc-800">
                <td className="px-3 py-2">
                  <span
                    className="inline-block"
                    style={{ paddingLeft: `${r.depth * 1.25}rem` }}
                  >
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">{r.code}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{r.kind}</td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium"
                        onClick={() => setEditingId(r.id === editingId ? null : r.id)}
                        disabled={busy}
                      >
                        {r.id === editingId ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-800"
                        onClick={() => void removeUnit(r.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <h4 className="text-sm font-semibold text-zinc-900">Edit: {editing.name}</h4>
          <EditOrgForm
            row={editing}
            allFlat={allFlat}
            busy={busy}
            onSave={(patch) => void updateUnit(editing.id, patch)}
            onCancel={() => setEditingId(null)}
          />
        </section>
      ) : null}
    </div>
  );
}

function EditOrgForm({
  row,
  allFlat,
  busy,
  onSave,
  onCancel,
}: {
  row: FlatRow;
  allFlat: FlatRow[];
  busy: boolean;
  onSave: (p: { name?: string; code?: string; kind?: OrgUnitKind; parentId?: string | null; sortOrder?: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code);
  const [kind, setKind] = useState<OrgUnitKind>(row.kind);
  const [parentId, setParentId] = useState(row.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(row.sortOrder);

  const parentOptions = useMemo(() => {
    const t = buildOrgUnitTree(allFlat);
    return t
      .filter((x) => x.id !== row.id)
      .map((r) => ({
        id: r.id,
        label: `${"\u00A0\u00A0".repeat(r.depth)}${r.name} (${r.code})`,
      }));
  }, [allFlat, row.id]);

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-zinc-600">
        Parent
        <select
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={busy}
        >
          <option value="">(root level)</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Name
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="text-xs text-zinc-600">
        Code
        <input
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="text-xs text-zinc-600">
        Type
        <select
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as OrgUnitKind)}
          disabled={busy}
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-600">
        Sort order
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          disabled={busy}
        />
      </label>
      <div className="flex items-end gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              name: name.trim() !== row.name ? name.trim() : undefined,
              code: code !== row.code ? code : undefined,
              kind: kind !== row.kind ? kind : undefined,
              parentId:
                (parentId || null) !== (row.parentId ?? null) ? (parentId || null) : undefined,
              sortOrder: sortOrder !== row.sortOrder ? sortOrder : undefined,
            })
          }
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
