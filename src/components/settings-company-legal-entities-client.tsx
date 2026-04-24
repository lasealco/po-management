"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { SerializedCompanyLegalEntity } from "@/lib/company-legal-entity";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/action-button";

const inputClass =
  "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-900";
const labelClass = "block text-xs font-medium text-zinc-600";

type OrgOption = { id: string; name: string; code: string };

export function SettingsCompanyLegalEntitiesClient({
  initialEntities,
  legalEntityOrgOptions,
  canEdit,
  preselectOrgUnitId,
  preselectEditId,
}: {
  initialEntities: SerializedCompanyLegalEntity[];
  legalEntityOrgOptions: OrgOption[];
  canEdit: boolean;
  preselectOrgUnitId?: string;
  preselectEditId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialEntities);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialEntities);
  }, [initialEntities]);

  const orgIdsWithProfile = useMemo(() => new Set(rows.map((r) => r.orgUnitId)), [rows]);
  const availableOrgsForCreate = useMemo(
    () => legalEntityOrgOptions.filter((o) => !orgIdsWithProfile.has(o.id)),
    [legalEntityOrgOptions, orgIdsWithProfile],
  );

  useEffect(() => {
    if (preselectEditId && rows.some((r) => r.id === preselectEditId)) {
      setEditingId(preselectEditId);
    }
  }, [preselectEditId, rows]);

  useEffect(() => {
    if (editingId && preselectEditId && editingId === preselectEditId) {
      requestAnimationFrame(() => {
        document.getElementById("edit-legal-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [editingId, preselectEditId]);

  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (preselectOrgUnitId && availableOrgsForCreate.some((o) => o.id === preselectOrgUnitId)) {
      setCreateOpen(true);
    }
  }, [preselectOrgUnitId, availableOrgsForCreate]);

  const editing = editingId ? rows.find((r) => r.id === editingId) : null;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}

      {canEdit && availableOrgsForCreate.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Add legal profile</h3>
              <p className="mt-1 text-xs text-zinc-600">
                Each <strong>legal-entity</strong> org node can have at most one profile.
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-[var(--arscmp-primary)] underline"
              onClick={() => setCreateOpen((v) => !v)}
            >
              {createOpen ? "Hide form" : "Show form"}
            </button>
          </div>
          {createOpen ? (
            <CreateLegalForm
              key={preselectOrgUnitId ?? "new"}
              availableOrgs={availableOrgsForCreate}
              defaultOrgUnitId={
                preselectOrgUnitId &&
                availableOrgsForCreate.some((o) => o.id === preselectOrgUnitId)
                  ? preselectOrgUnitId
                  : ""
              }
              busy={busy}
              onBusy={setBusy}
              onError={setError}
              onSuccess={() => {
                setError(null);
                setCreateOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </section>
      ) : null}

      {canEdit && availableOrgsForCreate.length === 0 && legalEntityOrgOptions.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Add at least one org unit of type <strong>Legal entity / subsidiary</strong> under{" "}
          <Link className="font-medium underline" href="/settings/organization/structure">
            Org &amp; sites
          </Link>{" "}
          before you can create a legal profile here.
        </p>
      ) : null}
      {canEdit && availableOrgsForCreate.length === 0 && legalEntityOrgOptions.length > 0 ? (
        <p className="text-sm text-zinc-600">
          All <strong>legal-entity</strong> org nodes in this tenant already have a legal profile. Add
          another org node of that type, or remove a profile, to add more.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Registered name</th>
              <th className="px-3 py-2">Org unit</th>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-zinc-500">
                  No legal profiles yet. Add a <strong>Legal entity</strong> org node, then create a
                  profile here.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-zinc-800">
                  <td className="px-3 py-2 font-medium">{r.registeredLegalName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.orgUnit.name}
                    <span className="ml-1 font-mono text-zinc-500">({r.orgUnit.code})</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.addressCountryCode ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium"
                          onClick={() => setEditingId((x) => (x === r.id ? null : r.id))}
                          disabled={busy}
                        >
                          {editingId === r.id ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-800"
                          onClick={() => void removeRow(r.id)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && canEdit ? (
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5" id="edit-legal-panel">
          <h3 className="text-sm font-semibold text-zinc-900">Edit: {editing.registeredLegalName}</h3>
          <EditLegalForm
            row={editing}
            busy={busy}
            onBusy={setBusy}
            onError={setError}
            onCancel={() => setEditingId(null)}
            onSuccess={() => {
              setError(null);
              setEditingId(null);
              router.refresh();
            }}
          />
        </section>
      ) : null}
    </div>
  );

  async function removeRow(id: string) {
    if (!window.confirm("Delete this legal profile? The org unit remains; only the statutory block is removed.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/company-legal-entities/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const parsed: unknown = await res.json().catch(() => ({}));
      setError(apiClientErrorMessage(parsed, "Could not delete."));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
    router.refresh();
  }
}

function CreateLegalForm({
  availableOrgs,
  defaultOrgUnitId,
  busy,
  onBusy,
  onError,
  onSuccess,
}: {
  availableOrgs: OrgOption[];
  defaultOrgUnitId: string;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (e: string | null) => void;
  onSuccess: () => void;
}) {
  const [orgUnitId, setOrgUnitId] = useState(defaultOrgUnitId);
  const [registeredLegalName, setRegisteredLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxVatId, setTaxVatId] = useState("");
  const [taxLocalId, setTaxLocalId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountryCode, setAddressCountryCode] = useState("");
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onBusy(true);
    const body: Record<string, unknown> = {
      orgUnitId,
      registeredLegalName: registeredLegalName.trim(),
      tradeName: tradeName.trim() || null,
      taxVatId: taxVatId.trim() || null,
      taxLocalId: taxLocalId.trim() || null,
      addressLine1: addressLine1.trim() || null,
      addressLine2: addressLine2.trim() || null,
      addressCity: addressCity.trim() || null,
      addressRegion: addressRegion.trim() || null,
      addressPostalCode: addressPostalCode.trim() || null,
      addressCountryCode: addressCountryCode.trim() || null,
      phone: phone.trim() || null,
      companyEmail: companyEmail.trim() || null,
      effectiveFrom: effectiveFrom.trim() || null,
      effectiveTo: effectiveTo.trim() || null,
      status,
    };
    const res = await fetch("/api/settings/company-legal-entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed: unknown = await res.json();
    onBusy(false);
    if (!res.ok) {
      onError(apiClientErrorMessage(parsed, "Could not create legal profile."));
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>
        Org unit (legal entity)
        <select
          required
          className={inputClass}
          value={orgUnitId}
          onChange={(e) => setOrgUnitId(e.target.value)}
          disabled={busy}
        >
          <option value="">— Select —</option>
          {availableOrgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Registered legal name *
        <input
          required
          className={inputClass}
          value={registeredLegalName}
          onChange={(e) => setRegisteredLegalName(e.target.value)}
          disabled={busy}
          placeholder="e.g. Acme Germany GmbH"
        />
      </label>
      <label className={labelClass}>
        Trade name
        <input className={inputClass} value={tradeName} onChange={(e) => setTradeName(e.target.value)} disabled={busy} />
      </label>
      <label className={labelClass}>
        VAT / tax id
        <input className={inputClass} value={taxVatId} onChange={(e) => setTaxVatId(e.target.value)} disabled={busy} />
      </label>
      <label className={labelClass}>
        Local tax id
        <input
          className={inputClass}
          value={taxLocalId}
          onChange={(e) => setTaxLocalId(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Address line 1
        <input
          className={inputClass}
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Address line 2
        <input
          className={inputClass}
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        City
        <input className={inputClass} value={addressCity} onChange={(e) => setAddressCity(e.target.value)} disabled={busy} />
      </label>
      <label className={labelClass}>
        Region / state
        <input
          className={inputClass}
          value={addressRegion}
          onChange={(e) => setAddressRegion(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Postal code
        <input
          className={inputClass}
          value={addressPostalCode}
          onChange={(e) => setAddressPostalCode(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Country (ISO-2)
        <input
          className={inputClass}
          value={addressCountryCode}
          onChange={(e) => setAddressCountryCode(e.target.value.toUpperCase())}
          maxLength={2}
          disabled={busy}
          placeholder="DE"
        />
      </label>
      <label className={labelClass}>
        Phone
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
      </label>
      <label className={labelClass}>
        Company email
        <input
          className={inputClass}
          type="email"
          value={companyEmail}
          onChange={(e) => setCompanyEmail(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Effective from
        <input
          className={inputClass}
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Effective to
        <input
          className={inputClass}
          type="date"
          value={effectiveTo}
          onChange={(e) => setEffectiveTo(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className={labelClass}>
        Status
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </label>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <ActionButton type="submit" className="w-full sm:w-auto" disabled={busy || !orgUnitId}>
          {busy ? "Saving…" : "Add legal profile"}
        </ActionButton>
      </div>
    </form>
  );
}

function EditLegalForm({
  row,
  busy,
  onBusy,
  onError,
  onCancel,
  onSuccess,
}: {
  row: SerializedCompanyLegalEntity;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (e: string | null) => void;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [registeredLegalName, setRegisteredLegalName] = useState(row.registeredLegalName);
  const [tradeName, setTradeName] = useState(row.tradeName ?? "");
  const [taxVatId, setTaxVatId] = useState(row.taxVatId ?? "");
  const [taxLocalId, setTaxLocalId] = useState(row.taxLocalId ?? "");
  const [addressLine1, setAddressLine1] = useState(row.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(row.addressLine2 ?? "");
  const [addressCity, setAddressCity] = useState(row.addressCity ?? "");
  const [addressRegion, setAddressRegion] = useState(row.addressRegion ?? "");
  const [addressPostalCode, setAddressPostalCode] = useState(row.addressPostalCode ?? "");
  const [addressCountryCode, setAddressCountryCode] = useState(row.addressCountryCode ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [companyEmail, setCompanyEmail] = useState(row.companyEmail ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(row.effectiveFrom ?? "");
  const [effectiveTo, setEffectiveTo] = useState(row.effectiveTo ?? "");
  const [status, setStatus] = useState(row.status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    onBusy(true);
    const res = await fetch(`/api/settings/company-legal-entities/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registeredLegalName: registeredLegalName.trim(),
        tradeName: tradeName.trim() || null,
        taxVatId: taxVatId.trim() || null,
        taxLocalId: taxLocalId.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        addressCity: addressCity.trim() || null,
        addressRegion: addressRegion.trim() || null,
        addressPostalCode: addressPostalCode.trim() || null,
        addressCountryCode: addressCountryCode.trim() || null,
        phone: phone.trim() || null,
        companyEmail: companyEmail.trim() || null,
        effectiveFrom: effectiveFrom.trim() || null,
        effectiveTo: effectiveTo.trim() || null,
        status,
      }),
    });
    const parsed: unknown = await res.json();
    onBusy(false);
    if (!res.ok) {
      onError(apiClientErrorMessage(parsed, "Could not update."));
      return;
    }
    onSuccess();
  }

  return (
    <form
      key={`${row.id}-${row.updatedAt}`}
      onSubmit={(e) => void submit(e)}
      className="mt-4 space-y-4"
    >
      <p className="text-xs text-zinc-500">
        Org unit: <span className="font-medium text-zinc-800">{row.orgUnit.name}</span> ({row.orgUnit.code})
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={`${labelClass} sm:col-span-2`}>
          Registered legal name *
          <input
            required
            className={inputClass}
            value={registeredLegalName}
            onChange={(e) => setRegisteredLegalName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Trade name
          <input className={inputClass} value={tradeName} onChange={(e) => setTradeName(e.target.value)} disabled={busy} />
        </label>
        <label className={labelClass}>
          VAT / tax id
          <input className={inputClass} value={taxVatId} onChange={(e) => setTaxVatId(e.target.value)} disabled={busy} />
        </label>
        <label className={labelClass}>
          Local tax id
          <input
            className={inputClass}
            value={taxLocalId}
            onChange={(e) => setTaxLocalId(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Address line 1
          <input
            className={inputClass}
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Address line 2
          <input
            className={inputClass}
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          City
          <input
            className={inputClass}
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Region / state
          <input
            className={inputClass}
            value={addressRegion}
            onChange={(e) => setAddressRegion(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Postal code
          <input
            className={inputClass}
            value={addressPostalCode}
            onChange={(e) => setAddressPostalCode(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Country (ISO-2)
          <input
            className={inputClass}
            value={addressCountryCode}
            onChange={(e) => setAddressCountryCode(e.target.value.toUpperCase())}
            maxLength={2}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Phone
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} />
        </label>
        <label className={labelClass}>
          Company email
          <input
            className={inputClass}
            type="email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Effective from
          <input
            className={inputClass}
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Effective to
          <input
            className={inputClass}
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          Status
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <ActionButton type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </ActionButton>
        <button
          type="button"
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
