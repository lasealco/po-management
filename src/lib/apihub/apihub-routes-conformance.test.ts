import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * P4 conformance: keep JSON body reads on the centralized budget helpers so caps do not drift
 * across handlers (`parseApiHubPostJsonForRouteWithBudget` / `parseApiHubRequestJsonWithBudget`).
 */
const APIHUB_ROUTES_ROOT = path.join(process.cwd(), "src/app/api/apihub");

function collectRouteTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...collectRouteTsFiles(p));
    } else if (ent.isFile() && ent.name === "route.ts") {
      out.push(p);
    }
  }
  return out;
}

describe("apihub HTTP routes conformance", () => {
  it("uses request-budget helpers for JSON bodies (no raw parseApiHubPostJsonForRoute / parseApiHubRequestJson calls)", () => {
    const files = collectRouteTsFiles(APIHUB_ROUTES_ROOT);
    expect(files.length).toBeGreaterThan(10);
    const offenders: string[] = [];
    for (const abs of files) {
      const text = fs.readFileSync(abs, "utf8");
      if (text.includes("parseApiHubPostJsonForRoute(")) {
        offenders.push(`${path.relative(process.cwd(), abs)}: parseApiHubPostJsonForRoute(`);
      }
      if (/\bparseApiHubRequestJson\s*\(/.test(text)) {
        offenders.push(`${path.relative(process.cwd(), abs)}: parseApiHubRequestJson(`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
