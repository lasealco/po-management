export type PlanningDemandSignal = {
  id: string;
  orderNo: string;
  productId: string | null;
  productLabel: string;
  customerLabel: string | null;
  quantity: number;
  requestedDate: string | null;
  status: string;
};

export type PlanningSupplySignal = {
  id: string;
  productId: string | null;
  productLabel: string;
  quantity: number;
  expectedDate: string | null;
  supplierLabel: string | null;
  status: string;
};

export type PlanningInventorySignal = {
  productId: string;
  productLabel: string;
  warehouseLabel: string;
  onHandQty: number;
  allocatedQty: number;
  onHold: boolean;
};

export type PlanningConstraintSignal = {
  id: string;
  source: "WMS" | "SUPPLIER" | "TRANSPORT" | "MASTER_DATA";
  label: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detail: string;
  objectType: string;
  objectId: string;
};

export type PlanningBridgeInputs = {
  horizonDays: number;
  demand: PlanningDemandSignal[];
  supply: PlanningSupplySignal[];
  inventory: PlanningInventorySignal[];
  constraints: PlanningConstraintSignal[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}

const SEVERITY_SCORE: Record<PlanningConstraintSignal["severity"], number> = {
  LOW: 15,
  MEDIUM: 35,
  HIGH: 65,
  CRITICAL: 90,
};

export function summarizePlanningDemand(demand: PlanningDemandSignal[]) {
  const byProduct = new Map<string, { productId: string | null; productLabel: string; quantity: number; orders: string[]; customers: string[] }>();
  for (const signal of demand) {
    const key = signal.productId ?? `description:${signal.productLabel.toLowerCase()}`;
    const previous = byProduct.get(key) ?? { productId: signal.productId, productLabel: signal.productLabel, quantity: 0, orders: [], customers: [] };
    previous.quantity += signal.quantity;
    previous.orders.push(signal.orderNo);
    if (signal.customerLabel) previous.customers.push(signal.customerLabel);
    byProduct.set(key, previous);
  }
  const products = Array.from(byProduct.values()).map((row) => ({
    ...row,
    quantity: roundQty(row.quantity),
    orders: Array.from(new Set(row.orders)).slice(0, 12),
    customers: Array.from(new Set(row.customers)).slice(0, 8),
  }));
  return {
    totalDemandUnits: roundQty(demand.reduce((sum, row) => sum + row.quantity, 0)),
    openDemandLines: demand.length,
    products: products.sort((a, b) => b.quantity - a.quantity || a.productLabel.localeCompare(b.productLabel)),
  };
}

export function summarizePlanningSupply(supply: PlanningSupplySignal[], inventory: PlanningInventorySignal[]) {
  const byProduct = new Map<string, { productId: string | null; productLabel: string; available: number; onHold: number; inbound: number; suppliers: string[]; warehouses: string[] }>();
  for (const row of inventory) {
    const previous = byProduct.get(row.productId) ?? { productId: row.productId, productLabel: row.productLabel, available: 0, onHold: 0, inbound: 0, suppliers: [], warehouses: [] };
    const net = Math.max(0, row.onHandQty - row.allocatedQty);
    if (row.onHold) previous.onHold += net;
    else previous.available += net;
    previous.warehouses.push(row.warehouseLabel);
    byProduct.set(row.productId, previous);
  }
  for (const row of supply) {
    const key = row.productId ?? `description:${row.productLabel.toLowerCase()}`;
    const previous = byProduct.get(key) ?? { productId: row.productId, productLabel: row.productLabel, available: 0, onHold: 0, inbound: 0, suppliers: [], warehouses: [] };
    previous.inbound += row.quantity;
    if (row.supplierLabel) previous.suppliers.push(row.supplierLabel);
    byProduct.set(key, previous);
  }
  const products = Array.from(byProduct.values()).map((row) => ({
    ...row,
    available: roundQty(row.available),
    onHold: roundQty(row.onHold),
    inbound: roundQty(row.inbound),
    suppliers: Array.from(new Set(row.suppliers)).slice(0, 8),
    warehouses: Array.from(new Set(row.warehouses)).slice(0, 8),
  }));
  return {
    availableUnits: roundQty(products.reduce((sum, row) => sum + row.available, 0)),
    onHoldUnits: roundQty(products.reduce((sum, row) => sum + row.onHold, 0)),
    inboundUnits: roundQty(products.reduce((sum, row) => sum + row.inbound, 0)),
    products: products.sort((a, b) => b.available + b.inbound - (a.available + a.inbound) || a.productLabel.localeCompare(b.productLabel)),
  };
}

export function buildDemandSupplyGaps(demandSummary: ReturnType<typeof summarizePlanningDemand>, supplySummary: ReturnType<typeof summarizePlanningSupply>) {
  const supplyByKey = new Map(supplySummary.products.map((row) => [row.productId ?? `description:${row.productLabel.toLowerCase()}`, row]));
  return demandSummary.products
    .map((demand) => {
      const supply = supplyByKey.get(demand.productId ?? `description:${demand.productLabel.toLowerCase()}`);
      const available = supply?.available ?? 0;
      const inbound = supply?.inbound ?? 0;
      const shortage = Math.max(0, demand.quantity - available - inbound);
      return {
        productId: demand.productId,
        productLabel: demand.productLabel,
        demandUnits: demand.quantity,
        availableUnits: available,
        inboundUnits: inbound,
        shortageUnits: roundQty(shortage),
        coveragePct: demand.quantity > 0 ? clamp(((available + inbound) / demand.quantity) * 100) : 100,
        orders: demand.orders,
        customers: demand.customers,
        suppliers: supply?.suppliers ?? [],
        warehouses: supply?.warehouses ?? [],
      };
    })
    .filter((gap) => gap.shortageUnits > 0 || gap.coveragePct < 100)
    .sort((a, b) => b.shortageUnits - a.shortageUnits || a.productLabel.localeCompare(b.productLabel));
}

export function scorePlanningRisk(input: {
  totalDemandUnits: number;
  shortageUnits: number;
  constraintCount: number;
  criticalConstraintCount: number;
}) {
  const shortagePressure = input.totalDemandUnits > 0 ? (input.shortageUnits / input.totalDemandUnits) * 65 : 0;
  const constraintPressure = Math.min(25, input.constraintCount * 4 + input.criticalConstraintCount * 8);
  return clamp(shortagePressure + constraintPressure);
}

export function buildPlanningBridgePacket(inputs: PlanningBridgeInputs) {
  const demandSummary = summarizePlanningDemand(inputs.demand);
  const supplySummary = summarizePlanningSupply(inputs.supply, inputs.inventory);
  const gaps = buildDemandSupplyGaps(demandSummary, supplySummary);
  const shortageUnits = roundQty(gaps.reduce((sum, gap) => sum + gap.shortageUnits, 0));
  const criticalConstraintCount = inputs.constraints.filter((constraint) => constraint.severity === "CRITICAL").length;
  const riskScore = scorePlanningRisk({
    totalDemandUnits: demandSummary.totalDemandUnits,
    shortageUnits,
    constraintCount: inputs.constraints.length,
    criticalConstraintCount,
  });
  const planningScore = clamp(100 - riskScore);
  const constraints = inputs.constraints
    .map((constraint) => ({ ...constraint, score: SEVERITY_SCORE[constraint.severity] }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const scenario = {
    title: `S&OP bridge ${inputs.horizonDays}-day constrained plan`,
    horizonDays: inputs.horizonDays,
    assumptions: [
      `${demandSummary.openDemandLines} demand line${demandSummary.openDemandLines === 1 ? "" : "s"} are included in the planning horizon.`,
      `${supplySummary.inboundUnits} inbound units and ${supplySummary.availableUnits} available units are treated as reviewable supply.`,
      "Plan is advisory only; sales orders, purchase orders, inventory, WMS tasks, and shipments require separate approval.",
    ],
    gapCount: gaps.length,
    topGaps: gaps.slice(0, 10),
    constraintCount: constraints.length,
  };
  const recommendations = {
    steps: [
      { step: "Protect constrained demand", owner: "Planning lead", action: "Prioritize customers/orders attached to the largest shortage gaps." },
      { step: "Expedite inbound supply", owner: "Procurement", action: "Confirm supplier commitments and pull in POs for products with shortage after inbound." },
      { step: "Release recoverable inventory", owner: "Warehouse", action: "Review held or allocated stock that can be released without breaking existing promises." },
      { step: "Resolve execution bottlenecks", owner: "WMS / transport", action: "Clear open WMS and transport constraints before committing the plan." },
      { step: "Approve S&OP packet", owner: "Leadership", action: "Queue scenario and recommendation packet for human approval before source-record changes." },
    ],
    priorityGaps: gaps.slice(0, 8),
    priorityConstraints: constraints.slice(0, 8),
  };
  const leadershipSummary = [
    `Planning bridge score ${planningScore}/100 for the next ${inputs.horizonDays} days.`,
    `Demand ${demandSummary.totalDemandUnits} units vs available ${supplySummary.availableUnits} and inbound ${supplySummary.inboundUnits}; shortage ${shortageUnits} units across ${gaps.length} product gap${gaps.length === 1 ? "" : "s"}.`,
    `${constraints.length} execution constraint${constraints.length === 1 ? "" : "s"} are included. Recommendations require human approval; no SO, PO, inventory, WMS, or shipment record is changed automatically.`,
  ].join("\n\n");

  return {
    title: `Planning bridge packet: score ${planningScore}/100`,
    status: "DRAFT",
    planningScore,
    horizonDays: inputs.horizonDays,
    demandUnits: demandSummary.totalDemandUnits,
    availableUnits: supplySummary.availableUnits,
    inboundUnits: supplySummary.inboundUnits,
    shortageUnits,
    demandSummary,
    supplySummary,
    gapAnalysis: { gaps, shortageUnits, gapCount: gaps.length },
    constraints: { items: constraints, criticalConstraintCount },
    scenario,
    recommendations,
    leadershipSummary,
  };
}
