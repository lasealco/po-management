/** Prisma comment on `TariffShipmentApplication.source`: MANUAL | RATING_ENGINE | SNAPSHOT */
const TARIFF_SHIPMENT_APPLICATION_SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  RATING_ENGINE: "Rating engine",
  SNAPSHOT: "Snapshot",
};

export function labelTariffShipmentApplicationSource(source: string): string {
  const known = TARIFF_SHIPMENT_APPLICATION_SOURCE_LABELS[source];
  if (known) return known;
  return source
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

/** Adds `sourceLabel` for JSON APIs (keeps canonical `source`). */
export function addTariffShipmentApplicationSourceLabel<T extends { source: string }>(
  row: T,
): T & { sourceLabel: string } {
  return { ...row, sourceLabel: labelTariffShipmentApplicationSource(row.source) };
}
