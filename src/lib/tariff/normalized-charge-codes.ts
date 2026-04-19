import { Prisma, type TariffChargeFamily, type TariffTransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  TARIFF_CHARGE_FAMILY_OPTIONS,
  TARIFF_TRANSPORT_MODE_OPTIONS,
  assertValidChargeCatalogCode,
  normalizeChargeCatalogCode,
} from "@/lib/tariff/normalized-charge-catalog-shared";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export {
  TARIFF_CHARGE_FAMILY_OPTIONS,
  TARIFF_TRANSPORT_MODE_OPTIONS,
  assertValidChargeCatalogCode,
  normalizeChargeCatalogCode,
} from "@/lib/tariff/normalized-charge-catalog-shared";

function parseChargeFamily(raw: unknown): TariffChargeFamily {
  const s = typeof raw === "string" ? raw.trim() : "";
  const allowed = TARIFF_CHARGE_FAMILY_OPTIONS as readonly string[];
  if (!allowed.includes(s)) {
    throw new TariffRepoError(
      "BAD_INPUT",
      `Invalid chargeFamily. Use one of: ${TARIFF_CHARGE_FAMILY_OPTIONS.join(", ")}.`,
    );
  }
  return s as TariffChargeFamily;
}

function parseTransportMode(raw: unknown): TariffTransportMode | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = typeof raw === "string" ? raw.trim() : "";
  const allowed = TARIFF_TRANSPORT_MODE_OPTIONS as readonly string[];
  if (!allowed.includes(s)) {
    throw new TariffRepoError(
      "BAD_INPUT",
      `Invalid transportMode. Use one of: ${TARIFF_TRANSPORT_MODE_OPTIONS.join(", ")}, or omit.`,
    );
  }
  return s as TariffTransportMode;
}

export async function listNormalizedChargeCodes() {
  return prisma.tariffNormalizedChargeCode.findMany({
    orderBy: { code: "asc" },
    take: 600,
  });
}

export async function createNormalizedChargeCode(input: {
  code: string;
  displayName: string;
  chargeFamily: TariffChargeFamily;
  transportMode?: TariffTransportMode | null;
  isLocalCharge?: boolean;
  isSurcharge?: boolean;
}) {
  const code = normalizeChargeCatalogCode(input.code);
  assertValidChargeCatalogCode(code);
  const displayName = input.displayName.trim();
  if (!displayName) throw new TariffRepoError("BAD_INPUT", "Display name is required.");
  try {
    return await prisma.tariffNormalizedChargeCode.create({
      data: {
        code,
        displayName,
        chargeFamily: input.chargeFamily,
        transportMode: input.transportMode ?? null,
        isLocalCharge: input.isLocalCharge ?? false,
        isSurcharge: input.isSurcharge ?? false,
        active: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new TariffRepoError("BAD_INPUT", "A charge code with that code already exists.");
    }
    throw e;
  }
}

export async function updateNormalizedChargeCode(
  params: { id: string },
  patch: Partial<{
    displayName: string;
    chargeFamily: TariffChargeFamily;
    transportMode: TariffTransportMode | null;
    isLocalCharge: boolean;
    isSurcharge: boolean;
    active: boolean;
  }>,
) {
  const row = await prisma.tariffNormalizedChargeCode.findUnique({ where: { id: params.id } });
  if (!row) throw new TariffRepoError("NOT_FOUND", "Charge code not found.");

  const data: Prisma.TariffNormalizedChargeCodeUpdateInput = {};
  if (patch.displayName !== undefined) {
    const d = patch.displayName.trim();
    if (!d) throw new TariffRepoError("BAD_INPUT", "Display name cannot be empty.");
    data.displayName = d;
  }
  if (patch.chargeFamily !== undefined) data.chargeFamily = patch.chargeFamily;
  if (patch.transportMode !== undefined) data.transportMode = patch.transportMode;
  if (patch.isLocalCharge !== undefined) data.isLocalCharge = patch.isLocalCharge;
  if (patch.isSurcharge !== undefined) data.isSurcharge = patch.isSurcharge;
  if (patch.active !== undefined) data.active = patch.active;

  return prisma.tariffNormalizedChargeCode.update({
    where: { id: params.id },
    data,
  });
}

export function parseCreateNormalizedChargeCodeBody(o: Record<string, unknown>) {
  const code = typeof o.code === "string" ? o.code : "";
  const displayName = typeof o.displayName === "string" ? o.displayName : "";
  const chargeFamily = parseChargeFamily(o.chargeFamily);
  const transportMode = parseTransportMode(o.transportMode);
  const isLocalCharge = typeof o.isLocalCharge === "boolean" ? o.isLocalCharge : false;
  const isSurcharge = typeof o.isSurcharge === "boolean" ? o.isSurcharge : false;
  return { code, displayName, chargeFamily, transportMode, isLocalCharge, isSurcharge };
}

export function parsePatchNormalizedChargeCodeBody(o: Record<string, unknown>) {
  const patch: Partial<{
    displayName: string;
    chargeFamily: TariffChargeFamily;
    transportMode: TariffTransportMode | null;
    isLocalCharge: boolean;
    isSurcharge: boolean;
    active: boolean;
  }> = {};
  if ("displayName" in o) {
    if (typeof o.displayName !== "string") throw new TariffRepoError("BAD_INPUT", "displayName must be a string.");
    patch.displayName = o.displayName;
  }
  if ("chargeFamily" in o) patch.chargeFamily = parseChargeFamily(o.chargeFamily);
  if ("transportMode" in o) patch.transportMode = parseTransportMode(o.transportMode);
  if ("isLocalCharge" in o) {
    if (typeof o.isLocalCharge !== "boolean") throw new TariffRepoError("BAD_INPUT", "isLocalCharge must be boolean.");
    patch.isLocalCharge = o.isLocalCharge;
  }
  if ("isSurcharge" in o) {
    if (typeof o.isSurcharge !== "boolean") throw new TariffRepoError("BAD_INPUT", "isSurcharge must be boolean.");
    patch.isSurcharge = o.isSurcharge;
  }
  if ("active" in o) {
    if (typeof o.active !== "boolean") throw new TariffRepoError("BAD_INPUT", "active must be boolean.");
    patch.active = o.active;
  }
  if (Object.keys(patch).length === 0) {
    throw new TariffRepoError("BAD_INPUT", "No valid fields to update.");
  }
  return patch;
}
