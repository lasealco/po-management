import type { TariffTransportMode, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";
import { normalizeEquipmentType } from "@/lib/tariff/rating-engine";

export function mapBookingModeToTariffMode(mode: TransportMode | null | undefined): TariffTransportMode {
  if (mode === "AIR") return "AIR";
  if (mode === "RAIL") return "RAIL";
  if (mode === "ROAD") return "TRUCK";
  return "OCEAN";
}

/** POL/POD/equipment hints for the lane rating UI, derived from booking + shipment. */
export async function getShipmentTariffRatingHints(params: {
  tenantId: string;
  shipmentId: string;
}): Promise<{
  shipmentId: string;
  pol: string | null;
  pod: string | null;
  equipment: string;
  transportMode: TariffTransportMode;
  bookingOriginCode: string | null;
  bookingDestinationCode: string | null;
}> {
  const shipment = await prisma.shipment.findFirst({
    where: { id: params.shipmentId, order: { tenantId: params.tenantId } },
    select: {
      id: true,
      transportMode: true,
      booking: {
        select: { originCode: true, destinationCode: true, mode: true },
      },
    },
  });
  if (!shipment) throw new TariffRepoError("NOT_FOUND", "Shipment not found.");

  const b = shipment.booking;
  const pol = (b?.originCode ?? "").trim().toUpperCase() || null;
  const pod = (b?.destinationCode ?? "").trim().toUpperCase() || null;
  const mode = b?.mode ?? shipment.transportMode;
  const transportMode = mapBookingModeToTariffMode(mode);

  return {
    shipmentId: shipment.id,
    pol,
    pod,
    equipment: normalizeEquipmentType("40HC"),
    transportMode,
    bookingOriginCode: b?.originCode?.trim() ?? null,
    bookingDestinationCode: b?.destinationCode?.trim() ?? null,
  };
}
