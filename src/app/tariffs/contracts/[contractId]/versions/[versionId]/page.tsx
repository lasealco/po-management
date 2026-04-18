import Link from "next/link";
import { notFound } from "next/navigation";

import { TariffVersionWorkbenchClient } from "@/components/tariffs/tariff-version-workbench-client";
import { TariffBadge, tariffApprovalTone, tariffContractStatusTone } from "@/components/tariffs/tariff-badges";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffAuditLogsForContractScope } from "@/lib/tariff/audit-log";
import { isTariffContractVersionFrozen } from "@/lib/tariff/version-guards";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isoDay(d: Date | null) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function TariffContractVersionPage({
  params,
}: {
  params: Promise<{ contractId: string; versionId: string }>;
}) {
  const { contractId, versionId } = await params;
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const version = await prisma.tariffContractVersion.findFirst({
    where: {
      id: versionId,
      contractHeaderId: contractId,
      contractHeader: { tenantId: tenant.id },
    },
    include: {
      contractHeader: { include: { provider: true, legalEntity: true } },
      rateLines: { orderBy: { id: "asc" } },
      chargeLines: { include: { normalizedChargeCode: true }, orderBy: { id: "asc" } },
      freeTimeRules: { orderBy: { id: "asc" } },
    },
  });

  if (!version) notFound();

  const frozen = isTariffContractVersionFrozen(version);
  const header = version.contractHeader;
  const providerLabel = header.provider.tradingName ?? header.provider.legalName;
  const entityLabel = header.legalEntity?.name ?? null;

  const [geoGroups, chargeCodes, auditLogs] = await Promise.all([
    prisma.tariffGeographyGroup.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true, code: true },
    }),
    prisma.tariffNormalizedChargeCode.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      take: 400,
      select: { id: true, code: true, displayName: true },
    }),
    listTariffAuditLogsForContractScope({
      headerId: header.id,
      versionIds: [version.id],
      relatedLineObjectIds: [
        ...version.rateLines.map((r) => r.id),
        ...version.chargeLines.map((c) => c.id),
        ...version.freeTimeRules.map((f) => f.id),
      ],
      take: 50,
    }),
  ]);

  const initialMeta = {
    id: version.id,
    versionNo: version.versionNo,
    approvalStatus: version.approvalStatus,
    status: version.status,
    sourceType: version.sourceType,
    sourceReference: version.sourceReference,
    sourceFileUrl: version.sourceFileUrl,
    validFrom: isoDay(version.validFrom),
    validTo: isoDay(version.validTo),
    bookingDateValidFrom: isoDay(version.bookingDateValidFrom),
    bookingDateValidTo: isoDay(version.bookingDateValidTo),
    sailingDateValidFrom: isoDay(version.sailingDateValidFrom),
    sailingDateValidTo: isoDay(version.sailingDateValidTo),
    comments: version.comments,
  };

  const initialRateLines = version.rateLines.map((r) => ({
    id: r.id,
    rateType: r.rateType,
    unitBasis: r.unitBasis,
    currency: r.currency,
    amount: r.amount.toString(),
    rawRateDescription: r.rawRateDescription,
    originScopeId: r.originScopeId,
    destinationScopeId: r.destinationScopeId,
    equipmentType: r.equipmentType,
  }));

  const initialChargeLines = version.chargeLines.map((c) => ({
    id: c.id,
    rawChargeName: c.rawChargeName,
    normalizedChargeCodeId: c.normalizedChargeCodeId,
    normalizedChargeCode: c.normalizedChargeCode
      ? { code: c.normalizedChargeCode.code, displayName: c.normalizedChargeCode.displayName }
      : null,
    unitBasis: c.unitBasis,
    currency: c.currency,
    amount: c.amount.toString(),
    geographyScopeId: c.geographyScopeId,
  }));

  const initialFreeTime = version.freeTimeRules.map((f) => ({
    id: f.id,
    ruleType: f.ruleType,
    freeDays: f.freeDays,
    geographyScopeId: f.geographyScopeId,
    importExportScope: f.importExportScope,
    equipmentScope: f.equipmentScope,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Version</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
            {header.title}{" "}
            <span className="text-zinc-500">· v{version.versionNo}</span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <TariffBadge label={version.approvalStatus} tone={tariffApprovalTone(version.approvalStatus)} />
            <TariffBadge label={version.status} tone={tariffContractStatusTone(version.status)} />
            {frozen ? <TariffBadge label="Frozen" tone="green" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/tariffs/contracts/${contractId}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← Contract header
          </Link>
          <Link href="/tariffs/contracts" className="font-medium text-zinc-600 hover:underline">
            Directory
          </Link>
        </div>
      </div>

      <TariffVersionWorkbenchClient
        key={version.updatedAt.toISOString()}
        contractId={contractId}
        versionId={versionId}
        frozen={frozen}
        canEdit={canEdit}
        contractTitle={header.title}
        transportMode={header.transportMode}
        providerLabel={providerLabel}
        entityLabel={entityLabel}
        headerStatus={header.status}
        initialMeta={initialMeta}
        initialRateLines={initialRateLines}
        initialChargeLines={initialChargeLines}
        initialFreeTime={initialFreeTime}
        geoGroups={geoGroups}
        chargeCodes={chargeCodes}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Activity</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Audit log entries for this contract header, version, and pricing lines (written when changes are made through
          the app).
        </p>
        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {auditLogs.length === 0 ? (
            <li className="py-6 text-center text-zinc-500">No activity recorded yet.</li>
          ) : null}
          {auditLogs.map((row) => (
            <li key={row.id} className="grid gap-1 py-3 sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-1">
              <span className="font-mono text-xs text-zinc-500">
                {row.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium text-zinc-800">{row.action}</span>
                  <span className="text-zinc-500">{row.objectType}</span>
                  <span className="text-zinc-600">
                    {row.user ? `${row.user.name} (${row.user.email})` : "System"}
                  </span>
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-zinc-500" title="Primary key for this audit row">
                  {row.objectId}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
