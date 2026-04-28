export type TransportModeLabel = "OCEAN" | "AIR" | "ROAD" | "RAIL" | "UNKNOWN";

export type SustainabilityShipmentSignal = {
  id: string;
  shipmentNo: string | null;
  mode: TransportModeLabel;
  carrierLabel: string | null;
  customerLabel: string | null;
  originCode: string | null;
  destinationCode: string | null;
  estimatedWeightKg: number | null;
  estimatedVolumeCbm: number | null;
  chargeableWeightKg: number | null;
  status: string;
};

export type SustainabilityWarehouseSignal = {
  id: string;
  warehouseLabel: string;
  movementType: string;
  quantity: number;
  occurredAt: string;
};

export type SustainabilitySupplierSignal = {
  id: string;
  name: string;
  countryCode: string | null;
  category: string;
};

export type SustainabilityInputs = {
  shipments: SustainabilityShipmentSignal[];
  warehouseActivity: SustainabilityWarehouseSignal[];
  suppliers: SustainabilitySupplierSignal[];
};

const MODE_FACTORS_KG_CO2E_PER_TONNE_KM: Record<TransportModeLabel, number> = {
  OCEAN: 0.016,
  RAIL: 0.028,
  ROAD: 0.105,
  AIR: 0.602,
  UNKNOWN: 0.18,
};

const DEFAULT_DISTANCE_KM: Record<TransportModeLabel, number> = {
  OCEAN: 9000,
  AIR: 6500,
  ROAD: 900,
  RAIL: 1200,
  UNKNOWN: 1800,
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function shipmentWeightKg(shipment: SustainabilityShipmentSignal) {
  return shipment.chargeableWeightKg ?? shipment.estimatedWeightKg ?? (shipment.estimatedVolumeCbm == null ? null : shipment.estimatedVolumeCbm * 167);
}

export function estimateShipmentEmissions(shipments: SustainabilityShipmentSignal[]) {
  return shipments.map((shipment) => {
    const weightKg = shipmentWeightKg(shipment);
    const mode = shipment.mode ?? "UNKNOWN";
    const distanceKm = DEFAULT_DISTANCE_KM[mode];
    const factor = MODE_FACTORS_KG_CO2E_PER_TONNE_KM[mode];
    const estimatedCo2eKg = weightKg == null ? 0 : round((weightKg / 1000) * distanceKm * factor);
    return {
      shipmentId: shipment.id,
      shipmentNo: shipment.shipmentNo,
      mode,
      carrierLabel: shipment.carrierLabel,
      customerLabel: shipment.customerLabel,
      originCode: shipment.originCode,
      destinationCode: shipment.destinationCode,
      weightKg,
      distanceKm,
      factorKgCo2ePerTonneKm: factor,
      estimatedCo2eKg,
      assumption: "Estimated with default mode factor and representative distance until audited ESG factors are configured.",
    };
  });
}

export function summarizeWarehouseActivity(activity: SustainabilityWarehouseSignal[]) {
  const byWarehouse = new Map<string, { warehouseLabel: string; eventCount: number; quantity: number }>();
  for (const event of activity) {
    const previous = byWarehouse.get(event.warehouseLabel) ?? { warehouseLabel: event.warehouseLabel, eventCount: 0, quantity: 0 };
    previous.eventCount += 1;
    previous.quantity += event.quantity;
    byWarehouse.set(event.warehouseLabel, previous);
  }
  const rows = Array.from(byWarehouse.values()).map((row) => ({ ...row, quantity: round(row.quantity), estimatedCo2eKg: round(row.quantity * 0.02) }));
  return {
    activityEvents: activity.length,
    totalQuantity: round(activity.reduce((sum, row) => sum + row.quantity, 0)),
    estimatedCo2eKg: round(rows.reduce((sum, row) => sum + row.estimatedCo2eKg, 0)),
    warehouses: rows.sort((a, b) => b.quantity - a.quantity || a.warehouseLabel.localeCompare(b.warehouseLabel)),
    assumption: "Warehouse activity emissions use a placeholder handling factor until energy-meter or site factors exist.",
  };
}

export function findSustainabilityDataGaps(inputs: SustainabilityInputs) {
  const gaps = [];
  for (const shipment of inputs.shipments) {
    if (shipment.mode === "UNKNOWN") gaps.push({ sourceType: "SHIPMENT", sourceId: shipment.id, severity: "HIGH" as const, gap: "Missing transport mode." });
    if (!shipment.carrierLabel) gaps.push({ sourceType: "SHIPMENT", sourceId: shipment.id, severity: "MEDIUM" as const, gap: "Missing carrier label." });
    if (!shipment.originCode || !shipment.destinationCode) gaps.push({ sourceType: "SHIPMENT", sourceId: shipment.id, severity: "MEDIUM" as const, gap: "Missing origin or destination code." });
    if (shipmentWeightKg(shipment) == null) gaps.push({ sourceType: "SHIPMENT", sourceId: shipment.id, severity: "HIGH" as const, gap: "Missing weight or volume basis for emissions estimate." });
  }
  for (const supplier of inputs.suppliers) {
    if (!supplier.countryCode) gaps.push({ sourceType: "SUPPLIER", sourceId: supplier.id, severity: "LOW" as const, gap: "Missing supplier country for ESG region reporting." });
  }
  if (inputs.warehouseActivity.length === 0) gaps.push({ sourceType: "WAREHOUSE", sourceId: "warehouse-activity", severity: "MEDIUM" as const, gap: "No warehouse activity events available for operational ESG estimate." });
  return gaps.sort((a, b) => (a.severity === b.severity ? a.sourceId.localeCompare(b.sourceId) : severityPenalty(b.severity) - severityPenalty(a.severity)));
}

function severityPenalty(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  if (severity === "CRITICAL") return 20;
  if (severity === "HIGH") return 12;
  if (severity === "MEDIUM") return 7;
  return 3;
}

export function buildGreenerRecommendations(emissions: ReturnType<typeof estimateShipmentEmissions>, gaps: ReturnType<typeof findSustainabilityDataGaps>) {
  const recommendations = [];
  for (const item of emissions) {
    if (item.mode === "AIR") {
      const oceanEstimate = round((Number(item.weightKg ?? 0) / 1000) * DEFAULT_DISTANCE_KM.OCEAN * MODE_FACTORS_KG_CO2E_PER_TONNE_KM.OCEAN);
      recommendations.push({
        type: "MODE_SHIFT",
        shipmentId: item.shipmentId,
        title: `Review air-to-ocean option for ${item.shipmentNo ?? item.shipmentId}`,
        estimatedSavingsKg: Math.max(0, round(item.estimatedCo2eKg - oceanEstimate)),
        guardrail: "Requires service, cost, and customer approval before routing changes.",
      });
    } else if (item.mode === "ROAD" && item.estimatedCo2eKg > 25) {
      const railEstimate = round((Number(item.weightKg ?? 0) / 1000) * DEFAULT_DISTANCE_KM.RAIL * MODE_FACTORS_KG_CO2E_PER_TONNE_KM.RAIL);
      recommendations.push({
        type: "MODE_SHIFT",
        shipmentId: item.shipmentId,
        title: `Review road-to-rail option for ${item.shipmentNo ?? item.shipmentId}`,
        estimatedSavingsKg: Math.max(0, round(item.estimatedCo2eKg - railEstimate)),
        guardrail: "Requires lane feasibility and transport approval before routing changes.",
      });
    }
  }
  if (gaps.length > 0) {
    recommendations.push({
      type: "DATA_COMPLETION",
      shipmentId: null,
      title: "Complete missing ESG evidence before customer-facing reporting",
      estimatedSavingsKg: 0,
      guardrail: "Do not publish ESG claims until missing data and assumptions are reviewed.",
    });
  }
  return recommendations.sort((a, b) => b.estimatedSavingsKg - a.estimatedSavingsKg || a.title.localeCompare(b.title));
}

export function buildSustainabilityPacket(inputs: SustainabilityInputs) {
  const shipmentEmissions = estimateShipmentEmissions(inputs.shipments);
  const warehouseSummary = summarizeWarehouseActivity(inputs.warehouseActivity);
  const missingData = findSustainabilityDataGaps(inputs);
  const recommendations = buildGreenerRecommendations(shipmentEmissions, missingData);
  const shipmentCo2e = round(shipmentEmissions.reduce((sum, row) => sum + row.estimatedCo2eKg, 0));
  const totalCo2e = round(shipmentCo2e + warehouseSummary.estimatedCo2eKg);
  const potentialSavingsKg = round(recommendations.reduce((sum, row) => sum + row.estimatedSavingsKg, 0));
  const sustainabilityScore = Math.max(0, Math.min(100, Math.round(100 - Math.min(45, missingData.length * 5) - Math.min(35, shipmentCo2e / 1000) + Math.min(15, potentialSavingsKg / 500))));
  const shipmentSummary = {
    shipmentCount: inputs.shipments.length,
    byMode: inputs.shipments.reduce<Record<string, number>>((acc, shipment) => {
      acc[shipment.mode] = (acc[shipment.mode] ?? 0) + 1;
      return acc;
    }, {}),
    estimatedShipmentCo2eKg: shipmentCo2e,
  };
  const assumptions = {
    factors: MODE_FACTORS_KG_CO2E_PER_TONNE_KM,
    distanceDefaultsKm: DEFAULT_DISTANCE_KM,
    warehouseHandlingKgCo2ePerUnit: 0.02,
    guardrail: "Estimates are planning-grade. Do not publish customer or board ESG claims without reviewed factors and completed data.",
  };
  const leadershipSummary = [
    `Sustainability score ${sustainabilityScore}/100 with estimated ${totalCo2e} kg CO2e across ${inputs.shipments.length} shipment${inputs.shipments.length === 1 ? "" : "s"} and ${inputs.warehouseActivity.length} warehouse activity event${inputs.warehouseActivity.length === 1 ? "" : "s"}.`,
    `${missingData.length} ESG data gap${missingData.length === 1 ? "" : "s"} and ${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} are ready for review; potential savings estimate is ${potentialSavingsKg} kg CO2e.`,
    "All factors are explicit assumptions; routing, carrier, warehouse, supplier, or customer-facing ESG claims require human approval.",
  ].join("\n\n");

  return {
    title: `Sustainability packet: score ${sustainabilityScore}/100`,
    status: "DRAFT",
    sustainabilityScore,
    estimatedCo2eKg: totalCo2e,
    potentialSavingsKg,
    missingDataCount: missingData.length,
    recommendationCount: recommendations.length,
    shipmentSummary,
    warehouseSummary,
    emissions: { shipments: shipmentEmissions, totalCo2eKg: totalCo2e },
    missingData,
    recommendations,
    assumptions,
    leadershipSummary,
  };
}
