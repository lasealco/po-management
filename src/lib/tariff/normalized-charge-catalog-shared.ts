/**
 * Charge catalog helpers and option lists safe for Client Components (no Prisma / DB).
 *
 * Keep in sync with **`src/app/tariffs/charge-codes/tariff-charge-codes-client.tsx`**, which imports
 * `TARIFF_CHARGE_FAMILY_OPTIONS` and `TARIFF_TRANSPORT_MODE_OPTIONS` for selects — do not fork duplicate literals there.
 */
import type { TariffChargeFamily, TariffTransportMode } from "@prisma/client";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export const TARIFF_CHARGE_FAMILY_OPTIONS = [
  "MAIN_CARRIAGE",
  "FUEL_ENVIRONMENTAL",
  "SEASONAL_EMERGENCY",
  "ORIGIN_TERMINAL",
  "DEST_TERMINAL",
  "ORIGIN_INLAND",
  "DEST_INLAND",
  "CUSTOMS_REGULATORY",
  "HANDLING_SPECIAL",
  "FREE_TIME_DELAY",
  "ADMIN_OTHER",
] as const satisfies readonly TariffChargeFamily[];

export const TARIFF_TRANSPORT_MODE_OPTIONS = [
  "OCEAN",
  "LCL",
  "AIR",
  "TRUCK",
  "RAIL",
  "LOCAL_SERVICE",
] as const satisfies readonly TariffTransportMode[];

export function normalizeChargeCatalogCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_");
}

export function assertValidChargeCatalogCode(code: string) {
  if (!/^[A-Z0-9_]{2,32}$/.test(code)) {
    throw new TariffRepoError("BAD_INPUT", "Code must be 2–32 uppercase letters, digits, or underscores.");
  }
}
