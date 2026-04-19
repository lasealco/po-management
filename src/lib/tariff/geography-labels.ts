import { TariffGeographyType } from "@prisma/client";

/** Stable order for selects and docs. */
export const TARIFF_GEOGRAPHY_TYPES_ORDERED: TariffGeographyType[] = [
  TariffGeographyType.GLOBAL_REGION,
  TariffGeographyType.SUBREGION,
  TariffGeographyType.COUNTRY,
  TariffGeographyType.PORT,
  TariffGeographyType.INLAND_POINT,
  TariffGeographyType.RAIL_RAMP,
  TariffGeographyType.ZONE,
  TariffGeographyType.ALIAS_GROUP,
];

const LABELS: Record<TariffGeographyType, string> = {
  [TariffGeographyType.GLOBAL_REGION]: "Global region",
  [TariffGeographyType.SUBREGION]: "Subregion",
  [TariffGeographyType.COUNTRY]: "Country",
  [TariffGeographyType.PORT]: "Port (UN/LOCODE)",
  [TariffGeographyType.INLAND_POINT]: "Inland point",
  [TariffGeographyType.RAIL_RAMP]: "Rail ramp",
  [TariffGeographyType.ZONE]: "Zone",
  [TariffGeographyType.ALIAS_GROUP]: "Alias group",
};

export function tariffGeographyTypeLabel(t: TariffGeographyType): string {
  return LABELS[t] ?? t;
}
