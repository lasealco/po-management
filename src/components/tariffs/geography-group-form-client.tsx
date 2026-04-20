"use client";

import type { TariffGeographyType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TARIFF_GEOGRAPHY_TYPES_ORDERED, tariffGeographyTypeLabel } from "@/lib/tariff/geography-labels";
import { TARIFF_GEOGRAPHY_PATH, tariffGeographyGroupPath } from "@/lib/tariff/tariff-workbench-urls";

export type GeographyGroupFormValues = {
  geographyType: TariffGeographyType;
  name: string;
  code: string;
  aliasSource: string;
  validFrom: string;
  validTo: string;
  active: boolean;
};

type Props = {
  mode: "create" | "edit";
  canEdit: boolean;
  groupId?: string;
  initial: GeographyGroupFormValues;
};

export function GeographyGroupFormClient({ mode, canEdit, groupId, initial }: Props) {
  const router = useRouter();
  const [geoType, setGeoType] = useState(initial.geographyType);
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [aliasSource, setAliasSource] = useState(initial.aliasSource);
  const [validFrom, setValidFrom] = useState(initial.validFrom);
  const [validTo, setValidTo] = useState(initial.validTo);
  const [active, setActive] = useState(initial.active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setPending(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/tariffs/geography-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            geographyType: geoType,
            name,
            code: code.trim() || null,
            aliasSource: aliasSource.trim() || null,
            validFrom: validFrom.trim() || null,
            validTo: validTo.trim() || null,
            active,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; group?: { id: string } };
        if (!res.ok) {
          setError(data.error ?? "Save failed.");
          return;
        }
        if (data.group?.id) router.push(tariffGeographyGroupPath(data.group.id));
        else router.push(TARIFF_GEOGRAPHY_PATH);
        router.refresh();
        return;
      }

      if (!groupId) return;
      const res = await fetch(`/api/tariffs/geography-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geographyType: geoType,
          name,
          code: code.trim() || null,
          aliasSource: aliasSource.trim() || null,
          validFrom: validFrom.trim() || null,
          validTo: validTo.trim() || null,
          active,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function removeGroup() {
    if (!groupId) return;
    if (!window.confirm("Delete this geography group and all of its members? Contract lines using it will clear their geography scope.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tariffs/geography-groups/${groupId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }
      router.push(TARIFF_GEOGRAPHY_PATH);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const readOnly = !canEdit;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Group type</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={geoType}
            disabled={readOnly}
            onChange={(e) => setGeoType(e.target.value as TariffGeographyType)}
          >
            {TARIFF_GEOGRAPHY_TYPES_ORDERED.map((t) => (
              <option key={t} value={t}>
                {tariffGeographyTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Internal code (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={code}
            disabled={readOnly}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CN-SOUTH"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Display name</span>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. South China"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Carrier / external label (optional)</span>
        <p className="mt-0.5 text-xs text-zinc-500">
          Store how a carrier names this region for future mapping tools. Free text for now.
        </p>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={aliasSource}
          disabled={readOnly}
          onChange={(e) => setAliasSource(e.target.value)}
          placeholder='e.g. Carrier X tariff book: "South China"'
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Valid from</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={validFrom}
            disabled={readOnly}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Valid to</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={validTo}
            disabled={readOnly}
            onChange={(e) => setValidTo(e.target.value)}
          />
        </label>
      </div>

      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} disabled={readOnly} onChange={(e) => setActive(e.target.checked)} />
          <span className="font-medium text-zinc-700">Active</span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() => void save()}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {mode === "create" ? "Create group" : "Save changes"}
          </button>
        ) : null}
        <Link
          href={TARIFF_GEOGRAPHY_PATH}
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to list
        </Link>
      </div>

      {mode === "edit" && canEdit && groupId ? (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <p className="text-sm font-medium text-red-900">Delete group</p>
          <p className="mt-1 text-xs text-red-800/90">
            Removes all members. Rate and charge lines that pointed at this group lose their geography scope (set to
            empty).
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void removeGroup()}
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Delete geography group
          </button>
        </div>
      ) : null}
    </div>
  );
}
