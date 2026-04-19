"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { TARIFF_CONTRACT_VERSION_SOURCE_TYPES } from "@/lib/tariff/contract-version-source-types";

const RATE_TYPES = [
  "BASE_RATE",
  "ALL_IN",
  "GATE_IN",
  "GATE_IN_ALL_IN",
  "GATE_IN_GATE_OUT",
  "ADD_ON",
  "LOCAL_CHARGE",
  "SURCHARGE",
  "CUSTOMS",
  "PRE_CARRIAGE",
  "ON_CARRIAGE",
] as const;

const RULE_TYPES = [
  "DEMURRAGE",
  "DETENTION",
  "COMBINED_DD",
  "STORAGE",
  "PLUGIN",
  "OTHER",
] as const;

const APPROVAL_STATUSES = ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"] as const;
const CONTRACT_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "APPROVED",
  "EXPIRED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export type SerializedGeo = { id: string; name: string; code: string | null };
export type SerializedChargeCode = { id: string; code: string; displayName: string };

export type SerializedRateLine = {
  id: string;
  rateType: string;
  unitBasis: string;
  currency: string;
  amount: string;
  rawRateDescription: string | null;
  originScopeId: string | null;
  destinationScopeId: string | null;
  equipmentType: string | null;
};

export type SerializedChargeLine = {
  id: string;
  rawChargeName: string;
  normalizedChargeCodeId: string | null;
  normalizedChargeCode: { code: string; displayName: string } | null;
  unitBasis: string;
  currency: string;
  amount: string;
  geographyScopeId: string | null;
};

export type SerializedFreeTime = {
  id: string;
  ruleType: string;
  freeDays: number;
  geographyScopeId: string | null;
  importExportScope: string | null;
  equipmentScope: string | null;
};

export type SerializedVersionMeta = {
  id: string;
  versionNo: number;
  approvalStatus: string;
  status: string;
  sourceType: string;
  sourceReference: string | null;
  sourceFileUrl: string | null;
  validFrom: string | null;
  validTo: string | null;
  bookingDateValidFrom: string | null;
  bookingDateValidTo: string | null;
  sailingDateValidFrom: string | null;
  sailingDateValidTo: string | null;
  comments: string | null;
};

function geoLabel(g: SerializedGeo) {
  return g.code ? `${g.name} (${g.code})` : g.name;
}

function httpUrlForOpen(raw: string | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t || !/^https?:\/\//i.test(t)) return null;
  return t;
}

export function TariffVersionWorkbenchClient({
  contractId,
  versionId,
  frozen,
  canEdit,
  contractTitle,
  transportMode,
  providerLabel,
  entityLabel,
  headerStatus,
  initialMeta,
  initialRateLines,
  initialChargeLines,
  initialFreeTime,
  geoGroups,
  chargeCodes,
}: {
  contractId: string;
  versionId: string;
  frozen: boolean;
  canEdit: boolean;
  contractTitle: string;
  transportMode: string;
  providerLabel: string;
  entityLabel: string | null;
  headerStatus: string;
  initialMeta: SerializedVersionMeta;
  initialRateLines: SerializedRateLine[];
  initialChargeLines: SerializedChargeLine[];
  initialFreeTime: SerializedFreeTime[];
  geoGroups: SerializedGeo[];
  chargeCodes: SerializedChargeCode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState(initialMeta);

  const base = `/api/tariffs/contracts/${contractId}/versions/${versionId}`;

  async function saveMeta() {
    setError(null);
    if (!canEdit || frozen) return;
    const res = await fetch(`${base}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: meta.sourceType,
        sourceReference: meta.sourceReference?.trim() ? meta.sourceReference.trim() : null,
        sourceFileUrl: meta.sourceFileUrl?.trim() ? meta.sourceFileUrl.trim() : null,
        approvalStatus: meta.approvalStatus,
        status: meta.status,
        validFrom: meta.validFrom || null,
        validTo: meta.validTo || null,
        bookingDateValidFrom: meta.bookingDateValidFrom || null,
        bookingDateValidTo: meta.bookingDateValidTo || null,
        sailingDateValidFrom: meta.sailingDateValidFrom || null,
        sailingDateValidTo: meta.sailingDateValidTo || null,
        comments: meta.comments,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(data?.error ?? `Version save failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Contract</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">{contractTitle}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Provider</dt>
            <dd className="font-medium text-zinc-900">{providerLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Legal entity</dt>
            <dd className="font-medium text-zinc-900">{entityLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Mode</dt>
            <dd className="font-medium text-zinc-900">{transportMode}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Header status</dt>
            <dd className="font-medium text-zinc-900">{headerStatus}</dd>
          </div>
        </dl>
      </section>

      {frozen ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This version is <strong>approved and frozen</strong>. Pricing lines and version fields cannot be edited
          (database-enforced).
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Version {meta.versionNo}</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Capture how this version entered the system so snapshots, imports, and disputes can point back to the same
          record.
        </p>

        <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Record identifiers</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-zinc-500">Contract header id</dt>
              <dd className="mt-1">
                <RecordIdCopy id={contractId} copyButtonLabel="Copy header id" />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-zinc-500">Contract version id</dt>
              <dd className="mt-1">
                <RecordIdCopy id={meta.id} copyButtonLabel="Copy version id" />
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-zinc-600">
            Use the version id when{" "}
            <Link href="/pricing-snapshots/new" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              freezing a pricing snapshot
            </Link>{" "}
            from this contract.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-1">
            <span className="font-medium text-zinc-700">Source type</span>
            <select
              disabled={!canEdit || frozen}
              value={meta.sourceType}
              onChange={(e) => setMeta((m) => ({ ...m, sourceType: e.target.value }))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            >
              {TARIFF_CONTRACT_VERSION_SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Source reference</span>
            <input
              type="text"
              disabled={!canEdit || frozen}
              value={meta.sourceReference ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, sourceReference: e.target.value || null }))}
              placeholder="e.g. carrier agreement id, workbook tab, email subject"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Source file URL</span>
            <input
              type="url"
              disabled={!canEdit || frozen}
              value={meta.sourceFileUrl ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, sourceFileUrl: e.target.value || null }))}
              placeholder="https://… (stored as text; no file upload in this build)"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
            {httpUrlForOpen(meta.sourceFileUrl) ? (
              <span className="text-xs text-zinc-500">
                <a
                  href={httpUrlForOpen(meta.sourceFileUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  Open URL
                </a>{" "}
                (opens in a new tab)
              </span>
            ) : null}
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Approval</span>
            <select
              disabled={!canEdit || frozen}
              value={meta.approvalStatus}
              onChange={(e) => setMeta((m) => ({ ...m, approvalStatus: e.target.value }))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            >
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Lifecycle status</span>
            <select
              disabled={!canEdit || frozen}
              value={meta.status}
              onChange={(e) => setMeta((m) => ({ ...m, status: e.target.value }))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Valid from</span>
            <input
              type="date"
              disabled={!canEdit || frozen}
              value={meta.validFrom?.slice(0, 10) ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, validFrom: e.target.value || null }))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Valid to</span>
            <input
              type="date"
              disabled={!canEdit || frozen}
              value={meta.validTo?.slice(0, 10) ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, validTo: e.target.value || null }))}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Comments</span>
            <textarea
              disabled={!canEdit || frozen}
              value={meta.comments ?? ""}
              onChange={(e) => setMeta((m) => ({ ...m, comments: e.target.value || null }))}
              rows={2}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100"
            />
          </label>
        </div>
        {canEdit && !frozen ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void saveMeta())}
            className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save version"}
          </button>
        ) : null}
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <LineSection
        title="Rate lines"
        frozen={frozen}
        canEdit={canEdit}
        base={base}
        geoGroups={geoGroups}
        rows={initialRateLines}
        kind="rate"
        onRefresh={() => router.refresh()}
      />
      <LineSection
        title="Charge lines"
        frozen={frozen}
        canEdit={canEdit}
        base={base}
        geoGroups={geoGroups}
        rows={initialChargeLines}
        kind="charge"
        chargeCodes={chargeCodes}
        onRefresh={() => router.refresh()}
      />
      <LineSection
        title="Free time rules"
        frozen={frozen}
        canEdit={canEdit}
        base={base}
        geoGroups={geoGroups}
        rows={initialFreeTime}
        kind="freeTime"
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}

function LineSection({
  title,
  frozen,
  canEdit,
  base,
  geoGroups,
  rows,
  kind,
  chargeCodes,
  onRefresh,
}: {
  title: string;
  frozen: boolean;
  canEdit: boolean;
  base: string;
  geoGroups: SerializedGeo[];
  rows: unknown[];
  kind: "rate" | "charge" | "freeTime";
  chargeCodes?: SerializedChargeCode[];
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              {kind === "rate" ? (
                <>
                  <th className="py-2 pr-3">Row id</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3">CCY</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Raw description</th>
                  <th className="py-2 pr-3">Origin</th>
                  <th className="py-2 pr-3">Destination</th>
                </>
              ) : null}
              {kind === "charge" ? (
                <>
                  <th className="py-2 pr-3">Row id</th>
                  <th className="py-2 pr-3">Raw name</th>
                  <th className="py-2 pr-3">Normalized</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3">CCY</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Geo</th>
                </>
              ) : null}
              {kind === "freeTime" ? (
                <>
                  <th className="py-2 pr-3">Row id</th>
                  <th className="py-2 pr-3">Rule</th>
                  <th className="py-2 pr-3">Days</th>
                  <th className="py-2 pr-3">Geo</th>
                  <th className="py-2 pr-3">I/E</th>
                </>
              ) : null}
              {canEdit && !frozen ? <th className="py-2 pr-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {kind === "rate"
              ? (rows as SerializedRateLine[]).map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 align-top">
                      <RecordIdCopy id={r.id} copyButtonLabel="Copy rate line id" />
                    </td>
                    <td className="py-2 pr-3 font-medium text-zinc-900">{r.rateType}</td>
                    <td className="py-2 pr-3 text-zinc-700">{r.unitBasis}</td>
                    <td className="py-2 pr-3">{r.currency}</td>
                    <td className="py-2 pr-3">{r.amount}</td>
                    <td className="max-w-[12rem] truncate py-2 pr-3 text-zinc-600">{r.rawRateDescription ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{r.originScopeId ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{r.destinationScopeId ?? "—"}</td>
                    {canEdit && !frozen ? (
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-red-700 hover:underline"
                          onClick={() =>
                            startTransition(async () => {
                              setError(null);
                              const res = await fetch(`${base}/rate-lines/${r.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const data = (await res.json().catch(() => null)) as { error?: string } | null;
                              if (!res.ok) setError(data?.error ?? "Delete failed");
                              else onRefresh();
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
            {kind === "charge"
              ? (rows as SerializedChargeLine[]).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 align-top">
                      <RecordIdCopy id={c.id} copyButtonLabel="Copy charge line id" />
                    </td>
                    <td className="py-2 pr-3 font-medium text-zinc-900">{c.rawChargeName}</td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {c.normalizedChargeCode?.code ?? c.normalizedChargeCodeId ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{c.unitBasis}</td>
                    <td className="py-2 pr-3">{c.currency}</td>
                    <td className="py-2 pr-3">{c.amount}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{c.geographyScopeId ?? "—"}</td>
                    {canEdit && !frozen ? (
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-red-700 hover:underline"
                          onClick={() =>
                            startTransition(async () => {
                              setError(null);
                              const res = await fetch(`${base}/charge-lines/${c.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const data = (await res.json().catch(() => null)) as { error?: string } | null;
                              if (!res.ok) setError(data?.error ?? "Delete failed");
                              else onRefresh();
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
            {kind === "freeTime"
              ? (rows as SerializedFreeTime[]).map((f) => (
                  <tr key={f.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 align-top">
                      <RecordIdCopy id={f.id} copyButtonLabel="Copy free time rule id" />
                    </td>
                    <td className="py-2 pr-3 font-medium text-zinc-900">{f.ruleType}</td>
                    <td className="py-2 pr-3">{f.freeDays}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{f.geographyScopeId ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{f.importExportScope ?? "—"}</td>
                    {canEdit && !frozen ? (
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="text-sm font-medium text-red-700 hover:underline"
                          onClick={() =>
                            startTransition(async () => {
                              setError(null);
                              const res = await fetch(`${base}/free-time-rules/${f.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const data = (await res.json().catch(() => null)) as { error?: string } | null;
                              if (!res.ok) setError(data?.error ?? "Delete failed");
                              else onRefresh();
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {canEdit && !frozen ? (
        <AddLineForm
          kind={kind}
          base={base}
          geoGroups={geoGroups}
          chargeCodes={chargeCodes ?? []}
          onDone={() => {
            setError(null);
            onRefresh();
          }}
          onError={setError}
        />
      ) : null}
    </section>
  );
}

function AddLineForm({
  kind,
  base,
  geoGroups,
  chargeCodes,
  onDone,
  onError,
}: {
  kind: "rate" | "charge" | "freeTime";
  base: string;
  geoGroups: SerializedGeo[];
  chargeCodes: SerializedChargeCode[];
  onDone: () => void;
  onError: (m: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [rateType, setRateType] = useState<string>("BASE_RATE");
  const [unitBasis, setUnitBasis] = useState("per_container");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("0");
  const [rawDesc, setRawDesc] = useState("");
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [rawName, setRawName] = useState("");
  const [normId, setNormId] = useState("");
  const [geoId, setGeoId] = useState("");
  const [ruleType, setRuleType] = useState<string>("DEMURRAGE");
  const [freeDays, setFreeDays] = useState("14");

  async function submit() {
    onError(null);
    if (kind === "rate") {
      const res = await fetch(`${base}/rate-lines`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateType,
          unitBasis,
          currency,
          amount,
          rawRateDescription: rawDesc || null,
          originScopeId: originId || null,
          destinationScopeId: destId || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        onError(data?.error ?? "Create failed");
        return;
      }
      onDone();
      return;
    }
    if (kind === "charge") {
      const res = await fetch(`${base}/charge-lines`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawChargeName: rawName,
          normalizedChargeCodeId: normId || null,
          unitBasis,
          currency,
          amount,
          geographyScopeId: geoId || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        onError(data?.error ?? "Create failed");
        return;
      }
      onDone();
      return;
    }
    const res = await fetch(`${base}/free-time-rules`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleType,
        freeDays: Number(freeDays),
        geographyScopeId: geoId || null,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      onError(data?.error ?? "Create failed");
      return;
    }
    onDone();
  }

  return (
    <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Add row</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {kind === "rate" ? (
          <>
            <label className="grid gap-1 text-xs">
              <span>Rate type</span>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                {RATE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span>Unit basis</span>
              <input
                value={unitBasis}
                onChange={(e) => setUnitBasis(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>CCY</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs sm:min-w-[10rem]">
              <span>Raw description</span>
              <input
                value={rawDesc}
                onChange={(e) => setRawDesc(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <GeoSelect label="Origin" value={originId} onChange={setOriginId} groups={geoGroups} />
            <GeoSelect label="Destination" value={destId} onChange={setDestId} groups={geoGroups} />
          </>
        ) : null}
        {kind === "charge" ? (
          <>
            <label className="grid gap-1 text-xs sm:min-w-[10rem]">
              <span>Raw charge name</span>
              <input
                value={rawName}
                onChange={(e) => setRawName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Normalized code</span>
              <select
                value={normId}
                onChange={(e) => setNormId(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">— None —</option>
                {chargeCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span>Unit basis</span>
              <input
                value={unitBasis}
                onChange={(e) => setUnitBasis(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>CCY</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span>Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <GeoSelect label="Geography" value={geoId} onChange={setGeoId} groups={geoGroups} />
          </>
        ) : null}
        {kind === "freeTime" ? (
          <>
            <label className="grid gap-1 text-xs">
              <span>Rule type</span>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                {RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span>Free days</span>
              <input
                value={freeDays}
                onChange={(e) => setFreeDays(e.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <GeoSelect label="Geography" value={geoId} onChange={setGeoId} groups={geoGroups} />
          </>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void submit())}
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}

function GeoSelect({
  label,
  value,
  onChange,
  groups,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groups: SerializedGeo[];
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[10rem] rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
      >
        <option value="">— None —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {geoLabel(g)}
          </option>
        ))}
      </select>
    </label>
  );
}
