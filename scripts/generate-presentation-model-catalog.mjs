#!/usr/bin/env node
/**
 * Writes docs/presentation/MODEL-CATALOG.md — grouped Prisma model list for decks.
 * Run from repo root: node scripts/generate-presentation-model-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const outPath = path.join(root, "docs", "presentation", "MODEL-CATALOG.md");

const raw = fs.readFileSync(schemaPath, "utf8");
const re = /^model\s+(\w+)\s*\{/gm;
const models = [];
let m;
while ((m = re.exec(raw)) !== null) {
  models.push(m[1]);
}
models.sort((a, b) => a.localeCompare(b));

function bucket(name) {
  if (name.startsWith("ApiHub")) return "Integrations (API hub)";
  if (name.startsWith("Ct")) return "Control Tower";
  if (name.startsWith("Crm")) return "CRM";
  if (name.startsWith("Wms") || name === "Warehouse" || name === "WarehouseZone" || name === "WarehouseBin")
    return "WMS & warehouses";
  if (
    name.startsWith("Inventory") ||
    name.startsWith("Outbound") ||
    name.startsWith("Replenishment")
  )
    return "WMS & warehouses";
  if (name.startsWith("Tariff")) return "Tariffs & contracts";
  if (name.startsWith("Quote")) return "RFQ";
  if (name.startsWith("BookingPricing")) return "Pricing snapshots";
  if (name.startsWith("Invoice")) return "Invoice audit";
  if (name.startsWith("SupplyChainTwin")) return "Supply Chain Twin";
  if (name.startsWith("Reference")) return "Reference data (global)";
  if (name.startsWith("Twin")) return "Supply Chain Twin";
  if (name.startsWith("LoadPlan") || name.startsWith("Split")) return "Orders & consolidation";
  if (
    name === "Tenant" ||
    name === "User" ||
    name === "UserRole" ||
    name === "Role" ||
    name === "RolePermission" ||
    name === "UserPreference"
  )
    return "Tenancy & identity";
  if (name.startsWith("Workflow")) return "Workflow engine";
  if (
    name === "PurchaseOrder" ||
    name === "PurchaseOrderItem" ||
    name === "SalesOrder" ||
    name === "Shipment" ||
    name === "ShipmentItem" ||
    name === "ShipmentBooking" ||
    name === "ShipmentMilestone" ||
    name === "OrderTransitionLog" ||
    name === "OrderChatMessage"
  )
    return "Orders & logistics execution";
  if (name.startsWith("Supplier") || name.startsWith("Product")) return "Suppliers & products";
  return "Other / shared";
}

const byBucket = new Map();
for (const name of models) {
  const b = bucket(name);
  if (!byBucket.has(b)) byBucket.set(b, []);
  byBucket.get(b).push(name);
}

const bucketOrder = [
  "Tenancy & identity",
  "Suppliers & products",
  "Workflow engine",
  "Orders & logistics execution",
  "Orders & consolidation",
  "WMS & warehouses",
  "Control Tower",
  "CRM",
  "Tariffs & contracts",
  "RFQ",
  "Pricing snapshots",
  "Invoice audit",
  "Integrations (API hub)",
  "Supply Chain Twin",
  "Reference data (global)",
  "Other / shared",
];

const lines = [
  "# Prisma model catalog (auto-generated)",
  "",
  `Generated from \`prisma/schema.prisma\` — **${models.length}** models. For relationships and columns, open the schema or the overview diagram in this folder.`,
  "",
  "| Module (presentation grouping) | Models |",
  "| --- | --- |",
];

for (const b of bucketOrder) {
  const list = byBucket.get(b);
  if (!list?.length) continue;
  lines.push(`| ${b} | ${list.map((x) => `\`${x}\``).join(", ")} |`);
  byBucket.delete(b);
}
for (const [b, list] of [...byBucket.entries()].sort((a, c) => a[0].localeCompare(c[0]))) {
  lines.push(`| ${b} | ${list.map((x) => `\`${x}\``).join(", ")} |`);
}

lines.push("", "---", "", `_Regenerate: \`node scripts/generate-presentation-model-catalog.mjs\`_`, "");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${path.relative(root, outPath)} (${models.length} models)`);
