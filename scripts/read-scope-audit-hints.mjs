#!/usr/bin/env node
/**
 * Informational read-scope audit (Phase 8): lists API route files that touch Prisma and tenantId
 * but do not reference known scope modules — **not** a guarantee of a bug; many routes (health,
 * auth, cron, true tenant-admin reads) are legitimately tenant-only.
 *
 * Usage: node scripts/read-scope-audit-hints.mjs
 * Exit 0 always (advisory). Review output in READ_SCOPE_INVENTORY.md workflow.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");

const SCOPE_PATH_MARKERS = [
  "viewer-scopes",
  "org-scope",
  "crm-scope",
  "wms-read-scope",
  "wms/billing", // some routes inline billing resolvers
  "control-tower/viewer",
  "delegation-guard",
  "sctwin-api-access", // SCT enforces its own access layer
  "scri/", // risk intel module hooks
  "getPurchaseOrderScopeWhere",
  "purchaseOrderWhereWithViewerScope",
  "loadWmsViewReadScope",
  "getCrmAccessScope",
  "controlTowerShipmentAccessWhere",
];

const SKIPPED_PATH_PARTS = [
  `${path.sep}health${path.sep}`,
  `${path.sep}readiness${path.sep}`,
  "/_lib/",
  "/auth/",
  "route 2", // editor duplicates / noise
];

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/^route\.(tsx?|js|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function hasScopeSignal(content) {
  return SCOPE_PATH_MARKERS.some((m) => content.includes(m));
}

function isSkippedPath(filePath) {
  const rel = filePath.split(root + path.sep).pop() || filePath;
  return SKIPPED_PATH_PARTS.some((s) => rel.includes(s));
}

function main() {
  const routes = walk(apiRoot);
  const hints = [];

  for (const f of routes) {
    if (isSkippedPath(f)) continue;
    const content = fs.readFileSync(f, "utf8");
    if (!/prisma\./.test(content)) continue;
    if (!/tenantId/.test(content)) continue;
    if (hasScopeSignal(content)) continue;
    hints.push(path.relative(root, f));
  }

  console.log("Read-scope audit hints (Prisma + tenantId, no common scope import markers):");
  console.log(`  Files: ${hints.length} (advisory; review in docs/engineering/READ_SCOPE_INVENTORY.md)\n`);
  for (const h of hints.sort()) {
    console.log(`  - ${h}`);
  }
  if (hints.length === 0) {
    console.log("  (none — or all route files use scope markers / were skipped by path heuristics)");
  }
}

main();
