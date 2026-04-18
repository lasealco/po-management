"use client";

import type { TariffGeographyType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { TARIFF_GEOGRAPHY_TYPES_ORDERED, tariffGeographyTypeLabel } from "@/lib/tariff/geography-labels";

export type GeoMemberRow = {
  id: string;
  memberCode: string;
  memberName: string | null;
  memberType: TariffGeographyType;
  validFrom: string | null;
  validTo: string | null;
};

type Props = {
  groupId: string;
  canEdit: boolean;
  members: GeoMemberRow[];
};

function emptyAddState() {
  return {
    memberCode: "",
    memberName: "",
    memberType: "PORT" as TariffGeographyType,
    validFrom: "",
    validTo: "",
  };
}

export function GeographyMembersClient({ groupId, canEdit, members }: Props) {
  const router = useRouter();
  const [add, setAdd] = useState(() => emptyAddState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(() => emptyAddState());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(m: GeoMemberRow) {
    setEditingId(m.id);
    setEditDraft({
      memberCode: m.memberCode,
      memberName: m.memberName ?? "",
      memberType: m.memberType,
      validFrom: m.validFrom ?? "",
      validTo: m.validTo ?? "",
    });
    setError(null);
  }

  async function createMember() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tariffs/geography-groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: add.memberCode.trim(),
          memberName: add.memberName.trim() || null,
          memberType: add.memberType,
          validFrom: add.validFrom.trim() || null,
          validTo: add.validTo.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not add member.");
        return;
      }
      setAdd(emptyAddState());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tariffs/geography-groups/${groupId}/members/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: editDraft.memberCode.trim(),
          memberName: editDraft.memberName.trim() || null,
          memberType: editDraft.memberType,
          validFrom: editDraft.validFrom.trim() || null,
          validTo: editDraft.validTo.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save member.");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function removeMember(id: string) {
    if (!window.confirm("Remove this member from the group?")) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tariffs/geography-groups/${groupId}/members/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete member.");
        return;
      }
      if (editingId === id) setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pl-4 pr-3">Code</th>
              <th className="py-2 pr-3">Member id</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Member type</th>
              <th className="py-2 pr-3">Valid from</th>
              <th className="py-2 pr-3">Valid to</th>
              {canEdit ? <th className="py-2 pr-4">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-zinc-500">
                  No members yet. Add UN/LOCODEs or other codes below.
                </td>
              </tr>
            ) : null}
            {members.map((m) =>
              editingId === m.id ? (
                <tr key={m.id} className="border-b border-zinc-100 bg-amber-50/40">
                  <td className="py-2 pl-4 pr-2">
                    <input
                      className="w-full min-w-[6rem] rounded border border-zinc-300 px-2 py-1 text-xs"
                      value={editDraft.memberCode}
                      onChange={(e) => setEditDraft((d) => ({ ...d, memberCode: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <RecordIdCopy id={m.id} copyButtonLabel="Copy member id" />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className="w-full min-w-[8rem] rounded border border-zinc-300 px-2 py-1 text-xs"
                      value={editDraft.memberName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, memberName: e.target.value }))}
                      placeholder="Display name"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      value={editDraft.memberType}
                      onChange={(e) => setEditDraft((d) => ({ ...d, memberType: e.target.value as TariffGeographyType }))}
                    >
                      {TARIFF_GEOGRAPHY_TYPES_ORDERED.map((t) => (
                        <option key={t} value={t}>
                          {tariffGeographyTypeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="date"
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      value={editDraft.validFrom}
                      onChange={(e) => setEditDraft((d) => ({ ...d, validFrom: e.target.value }))}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="date"
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      value={editDraft.validTo}
                      onChange={(e) => setEditDraft((d) => ({ ...d, validTo: e.target.value }))}
                    />
                  </td>
                  {canEdit ? (
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={pending || !editDraft.memberCode.trim()}
                        onClick={() => void saveEdit()}
                        className="rounded-md bg-[var(--arscmp-primary)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700"
                      >
                        Cancel
                      </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ) : (
                <tr key={m.id} className="border-b border-zinc-100">
                  <td className="py-2 pl-4 pr-3 font-mono text-xs">{m.memberCode}</td>
                  <td className="py-2 pr-3 align-top">
                    <RecordIdCopy id={m.id} copyButtonLabel="Copy member id" />
                  </td>
                  <td className="py-2 pr-3 text-zinc-700">{m.memberName ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-600">{tariffGeographyTypeLabel(m.memberType)}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{m.validFrom ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{m.validTo ?? "—"}</td>
                  {canEdit ? (
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startEdit(m)}
                        className="mr-2 text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void removeMember(m.id)}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-sm font-medium text-zinc-800">Add member</p>
          <p className="mt-1 text-xs text-zinc-600">
            Use standard codes (e.g. UN/LOCODE for ports: CNYTN, CNSHK). Member type should match what the code
            represents.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Code</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={add.memberCode}
                onChange={(e) => setAdd((a) => ({ ...a, memberCode: e.target.value }))}
                placeholder="CNYTN"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Name (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={add.memberName}
                onChange={(e) => setAdd((a) => ({ ...a, memberName: e.target.value }))}
                placeholder="Yantian"
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Member type</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={add.memberType}
                onChange={(e) => setAdd((a) => ({ ...a, memberType: e.target.value as TariffGeographyType }))}
              >
                {TARIFF_GEOGRAPHY_TYPES_ORDERED.map((t) => (
                  <option key={t} value={t}>
                    {tariffGeographyTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Valid from</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={add.validFrom}
                onChange={(e) => setAdd((a) => ({ ...a, validFrom: e.target.value }))}
              />
            </label>
            <label className="block text-xs">
              <span className="font-medium text-zinc-600">Valid to</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                value={add.validTo}
                onChange={(e) => setAdd((a) => ({ ...a, validTo: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pending || !add.memberCode.trim()}
            onClick={() => void createMember()}
            className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            Add member
          </button>
        </div>
      ) : null}
    </div>
  );
}
