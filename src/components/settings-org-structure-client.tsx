"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import {
  ORG_CODE_PRESETS_FACILITY,
  ORG_CODE_PRESETS_GROUP,
  ORG_CODE_PRESETS_REGION,
} from "@/lib/org-code-presets";
import { isPresetGroupCode, isPresetRegionCode } from "@/lib/org-code-presets";
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

const PRESET_FACILITY = ORG_CODE_PRESETS_FACILITY as readonly string[];

const FACILITY_OTHER = "__other__";

function isFacilityKind(k: OrgUnitKind) {
  return k === "LEGAL_ENTITY" || k === "SITE" || k === "OFFICE";
}

type RefCountry = { isoAlpha2: string; name: string };

function OrgUnitCodeField({
  kind,
  value,
  onChange,
  referenceCountries,
  facilityMode,
  onFacilityMode,
  allowLegacyValue,
  disabled,
  selectClassName = "mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm",
}: {
  kind: OrgUnitKind;
  value: string;
  onChange: (v: string) => void;
  referenceCountries: RefCountry[];
  facilityMode: "preset" | "custom";
  onFacilityMode: (m: "preset" | "custom") => void;
  allowLegacyValue?: string | null;
  disabled: boolean;
  selectClassName?: string;
}) {
  const regions = ORG_CODE_PRESETS_REGION as readonly string[];
  const groups = ORG_CODE_PRESETS_GROUP as readonly string[];

  if (kind === "REGION") {
    return (
      <select
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Select region code —</option>
        {regions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {allowLegacyValue && !isPresetRegionCode(allowLegacyValue) ? (
          <option value={allowLegacyValue}>{`Keep (legacy): ${allowLegacyValue}`}</option>
        ) : null}
      </select>
    );
  }
  if (kind === "GROUP") {
    return (
      <select
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Select group / global code —</option>
        {groups.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {allowLegacyValue && !isPresetGroupCode(allowLegacyValue) ? (
          <option value={allowLegacyValue}>{`Keep (legacy): ${allowLegacyValue}`}</option>
        ) : null}
      </select>
    );
  }
  if (kind === "COUNTRY") {
    return (
      <select
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Select ISO-2 country —</option>
        {referenceCountries.map((c) => (
          <option key={c.isoAlpha2} value={c.isoAlpha2}>
            {c.isoAlpha2} — {c.name}
          </option>
        ))}
        {allowLegacyValue && !referenceCountries.some((c) => c.isoAlpha2 === allowLegacyValue) ? (
          <option value={allowLegacyValue}>{`Keep (legacy): ${allowLegacyValue}`}</option>
        ) : null}
      </select>
    );
  }

  if (isFacilityKind(kind)) {
    if (facilityMode === "custom") {
      return (
        <div className="mt-1 space-y-2">
          <input
            className="w-full rounded-xl border border-zinc-300 px-2 py-2 text-sm font-mono"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="2–32 chars, A–Z, 0–9, hyphens"
            maxLength={32}
            disabled={disabled}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            type="button"
            className="text-xs font-medium text-zinc-600 underline"
            onClick={() => {
              onFacilityMode("preset");
              onChange("");
            }}
            disabled={disabled}
          >
            Use standard code list
          </button>
        </div>
      );
    }
    const inPreset = PRESET_FACILITY.includes(value);
    const selectValue = inPreset || value === "" ? value : FACILITY_OTHER;
    return (
      <div className="mt-1 space-y-1">
        <select
          className={selectClassName}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === FACILITY_OTHER) {
              onFacilityMode("custom");
              onChange("");
            } else {
              onChange(v);
            }
          }}
          disabled={disabled}
        >
          <option value="">— Standard code —</option>
          {PRESET_FACILITY.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={FACILITY_OTHER}>Other (type validated code)…</option>
        </select>
      </div>
    );
  }

  return null;
}

type FlatRow = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  kind: OrgUnitKind;
  sortOrder: number;
};

function isCreateCodeComplete(
  kind: OrgUnitKind,
  code: string,
  facilityMode: "preset" | "custom",
): boolean {
  const t = code.trim();
  if (!t) return false;
  if (kind === "REGION") return isPresetRegionCode(t);
  if (kind === "GROUP") return isPresetGroupCode(t);
  if (kind === "COUNTRY") return /^[A-Z]{2}$/.test(t);
  if (isFacilityKind(kind)) {
    if (facilityMode === "custom") return t.length >= 2;
    return PRESET_FACILITY.includes(t);
  }
  return false;
}

export function SettingsOrgStructureClient({
  canEdit,
  initialTree,
  allFlat,
  referenceCountries,
}: {
  canEdit: boolean;
  initialTree: OrgUnitTreeRow[];
  allFlat: FlatRow[];
  referenceCountries: RefCountry[];
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
    facilityCodeMode: "preset" as "preset" | "custom",
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
    setForm({
      name: "",
      code: "",
      kind: "REGION",
      parentId: "",
      sortOrder: 0,
      facilityCodeMode: "preset",
    });
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
            Code is a stable key, unique per company, and appears in user assignment dropdowns.
            Regions, groups, and countries use <strong>standardized</strong> lists; sites and legal
            entities use a short list or a validated custom code.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col text-xs sm:col-span-2">
              <span className="text-zinc-600">Parent</span>
              <select
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                disabled={busy}
              >
                <option value="">Top level (no parent under tenant)</option>
                {parentSelectRows.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 text-[11px] leading-snug text-zinc-500">
                Nesting appears after you create at least one unit. The tenant (company) is not a row
                here—pick top level for your first region or group, then add children under it.
              </span>
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
              <OrgUnitCodeField
                kind={form.kind}
                value={form.code}
                onChange={(v) => setForm((f) => ({ ...f, code: v }))}
                referenceCountries={referenceCountries}
                facilityMode={form.facilityCodeMode}
                onFacilityMode={(m) => setForm((f) => ({ ...f, facilityCodeMode: m }))}
                disabled={busy}
                selectClassName="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs sm:col-span-2">
              <span className="text-zinc-600">Type</span>
              <select
                className="mt-1 rounded-xl border border-zinc-300 px-2 py-2 text-sm"
                value={form.kind}
                onChange={(e) => {
                  const kind = e.target.value as OrgUnitKind;
                  setForm((f) => ({
                    ...f,
                    kind,
                    code: "",
                    facilityCodeMode: isFacilityKind(kind) ? "preset" : f.facilityCodeMode,
                  }));
                }}
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
                disabled={
                  busy ||
                  !form.name.trim() ||
                  !isCreateCodeComplete(form.kind, form.code, form.facilityCodeMode)
                }
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
            key={editing.id}
            row={editing}
            allFlat={allFlat}
            referenceCountries={referenceCountries}
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
  referenceCountries,
  busy,
  onSave,
  onCancel,
}: {
  row: FlatRow;
  allFlat: FlatRow[];
  referenceCountries: RefCountry[];
  busy: boolean;
  onSave: (p: { name?: string; code?: string; kind?: OrgUnitKind; parentId?: string | null; sortOrder?: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code);
  const [kind, setKind] = useState<OrgUnitKind>(row.kind);
  const [parentId, setParentId] = useState(row.parentId ?? "");
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  const [facilityCodeMode, setFacilityCodeMode] = useState<"preset" | "custom">(() =>
    isFacilityKind(row.kind) && !PRESET_FACILITY.includes(row.code) ? "custom" : "preset",
  );

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
        <OrgUnitCodeField
          kind={kind}
          value={code}
          onChange={setCode}
          referenceCountries={referenceCountries}
          facilityMode={facilityCodeMode}
          onFacilityMode={setFacilityCodeMode}
          allowLegacyValue={row.code}
          disabled={busy}
          selectClassName="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Type
        <select
          className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as OrgUnitKind;
            setKind(k);
            setCode("");
            setFacilityCodeMode("preset");
          }}
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
