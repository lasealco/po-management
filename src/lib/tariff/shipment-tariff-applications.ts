import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export async function listTariffShipmentApplications(params: { tenantId: string; shipmentId: string }) {
  return prisma.tariffShipmentApplication.findMany({
    where: { tenantId: params.tenantId, shipmentId: params.shipmentId },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    include: {
      contractVersion: {
        select: {
          id: true,
          versionNo: true,
          validFrom: true,
          validTo: true,
          contractHeader: {
            select: {
              id: true,
              contractNumber: true,
              title: true,
              transportMode: true,
              provider: { select: { id: true, legalName: true, tradingName: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Attach (or refresh) a contract version on a shipment. When `isPrimary` is true, clears other primaries.
 */
export async function attachTariffVersionToShipment(params: {
  tenantId: string;
  shipmentId: string;
  contractVersionId: string;
  isPrimary?: boolean;
  source?: string;
  polCode?: string | null;
  podCode?: string | null;
  equipmentType?: string | null;
  appliedNotes?: string | null;
  createdById: string | null;
}) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: params.shipmentId, order: { tenantId: params.tenantId } },
    select: { id: true },
  });
  if (!shipment) throw new TariffRepoError("NOT_FOUND", "Shipment not found.");

  const version = await prisma.tariffContractVersion.findFirst({
    where: { id: params.contractVersionId, contractHeader: { tenantId: params.tenantId } },
    select: { id: true },
  });
  if (!version) throw new TariffRepoError("NOT_FOUND", "Contract version not found for this tenant.");

  const isPrimary = params.isPrimary ?? true;

  return prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.tariffShipmentApplication.updateMany({
        where: { tenantId: params.tenantId, shipmentId: params.shipmentId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.tariffShipmentApplication.upsert({
      where: {
        shipmentId_contractVersionId: {
          shipmentId: params.shipmentId,
          contractVersionId: params.contractVersionId,
        },
      },
      create: {
        tenantId: params.tenantId,
        shipmentId: params.shipmentId,
        contractVersionId: params.contractVersionId,
        isPrimary,
        source: (params.source ?? "MANUAL").trim() || "MANUAL",
        polCode: params.polCode?.trim().toUpperCase() || null,
        podCode: params.podCode?.trim().toUpperCase() || null,
        equipmentType: params.equipmentType?.trim() || null,
        appliedNotes: params.appliedNotes?.trim() || null,
        createdById: params.createdById,
      },
      update: {
        isPrimary,
        source: (params.source ?? "MANUAL").trim() || "MANUAL",
        polCode: params.polCode?.trim().toUpperCase() || null,
        podCode: params.podCode?.trim().toUpperCase() || null,
        equipmentType: params.equipmentType?.trim() || null,
        appliedNotes: params.appliedNotes?.trim() || null,
      },
    });
  });
}
