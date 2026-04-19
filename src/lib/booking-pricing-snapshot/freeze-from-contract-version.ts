import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  PRICING_SNAPSHOT_BREAKDOWN_SCHEMA_VERSION,
  TOTAL_DERIVATION_SUM_RATE_AND_CHARGES,
} from "@/lib/booking-pricing-snapshot/constants";
import { dateIso, decString } from "@/lib/booking-pricing-snapshot/serialize";
import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

function geoSnap(g: { id: string; name: string; code: string | null } | null) {
  if (!g) return null;
  return { id: g.id, name: g.name, code: g.code };
}

export async function buildContractVersionSnapshotPayload(params: { tenantId: string; contractVersionId: string }) {
  const version = await prisma.tariffContractVersion.findFirst({
    where: { id: params.contractVersionId, contractHeader: { tenantId: params.tenantId } },
    include: {
      contractHeader: { include: { provider: true, legalEntity: true } },
      rateLines: { include: { originScope: true, destinationScope: true } },
      chargeLines: { include: { normalizedChargeCode: true, geographyScope: true } },
      freeTimeRules: { include: { geographyScope: true } },
    },
  });
  if (!version) throw new SnapshotRepoError("NOT_FOUND", "Contract version not found for this tenant.");

  const rateSubtotal = version.rateLines.reduce((s, r) => s + Number(r.amount), 0);
  const chargeSubtotal = version.chargeLines.reduce((s, c) => s + Number(c.amount), 0);
  const total = rateSubtotal + chargeSubtotal;

  const currencies = new Set<string>();
  for (const r of version.rateLines) currencies.add(r.currency);
  for (const c of version.chargeLines) currencies.add(c.currency);
  const currency =
    version.rateLines[0]?.currency ?? version.chargeLines[0]?.currency ?? "USD";

  const breakdown: Prisma.InputJsonValue = {
    schemaVersion: PRICING_SNAPSHOT_BREAKDOWN_SCHEMA_VERSION,
    sourceType: "TARIFF_CONTRACT_VERSION",
    sourceRecordId: version.id,
    contract: {
      id: version.contractHeader.id,
      title: version.contractHeader.title,
      contractNumber: version.contractHeader.contractNumber,
      transportMode: version.contractHeader.transportMode,
      providerLegalName: version.contractHeader.provider.legalName,
      legalEntityName: version.contractHeader.legalEntity?.name ?? null,
    },
    version: {
      id: version.id,
      versionNo: version.versionNo,
      approvalStatus: version.approvalStatus,
      status: version.status,
      validFrom: dateIso(version.validFrom),
      validTo: dateIso(version.validTo),
      bookingDateValidFrom: dateIso(version.bookingDateValidFrom),
      bookingDateValidTo: dateIso(version.bookingDateValidTo),
      sailingDateValidFrom: dateIso(version.sailingDateValidFrom),
      sailingDateValidTo: dateIso(version.sailingDateValidTo),
    },
    rateLines: version.rateLines.map((r) => ({
      id: r.id,
      rateType: r.rateType,
      equipmentType: r.equipmentType,
      unitBasis: r.unitBasis,
      currency: r.currency,
      amount: decString(r.amount),
      originScope: geoSnap(r.originScope),
      destinationScope: geoSnap(r.destinationScope),
      validFrom: dateIso(r.validFrom),
      validTo: dateIso(r.validTo),
      notes: r.notes,
    })),
    chargeLines: version.chargeLines.map((c) => ({
      id: c.id,
      rawChargeName: c.rawChargeName,
      normalizedCode: c.normalizedChargeCode?.code ?? null,
      equipmentScope: c.equipmentScope,
      unitBasis: c.unitBasis,
      currency: c.currency,
      amount: decString(c.amount),
      isIncluded: c.isIncluded,
      isMandatory: c.isMandatory,
      geographyScope: geoSnap(c.geographyScope),
      validFrom: dateIso(c.validFrom),
      validTo: dateIso(c.validTo),
    })),
    totals: {
      rateSubtotal,
      chargeSubtotal,
      grand: total,
      currencyAssumption: currencies.size <= 1 ? "SINGLE_CURRENCY" : "MULTIPLE_CURRENCIES_USE_PRIMARY",
    },
  };

  const freeTimeBasis: Prisma.InputJsonValue = {
    schemaVersion: 1,
    rules: version.freeTimeRules.map((f) => ({
      id: f.id,
      ruleType: f.ruleType,
      freeDays: f.freeDays,
      importExportScope: f.importExportScope,
      equipmentScope: f.equipmentScope,
      geographyScope: geoSnap(f.geographyScope),
      validFrom: dateIso(f.validFrom),
      validTo: dateIso(f.validTo),
      notes: f.notes,
    })),
  };

  const sourceSummary = `${version.contractHeader.title} · v${version.versionNo} · ${version.contractHeader.provider.legalName}`;

  return {
    currency,
    totalEstimatedCost: total,
    breakdown,
    freeTimeBasis,
    totalDerivation: TOTAL_DERIVATION_SUM_RATE_AND_CHARGES,
    sourceSummary,
  };
}
