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

function exportedHttpMethods(text: string): Set<string> {
  const methods = new Set<string>();
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    methods.add(m[1]);
  }
  return methods;
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

  it("POST and PATCH handlers use WithBudget JSON helpers (bounded reads)", () => {
    const files = collectRouteTsFiles(APIHUB_ROUTES_ROOT);
    const offenders: string[] = [];
    for (const abs of files) {
      const text = fs.readFileSync(abs, "utf8");
      const methods = exportedHttpMethods(text);
      if (!methods.has("POST") && !methods.has("PATCH")) continue;
      const hasBudget =
        text.includes("parseApiHubPostJsonForRouteWithBudget") ||
        text.includes("parseApiHubRequestJsonWithBudget");
      if (!hasBudget) {
        offenders.push(path.relative(process.cwd(), abs));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not call request.json() (bypasses centralized body limits)", () => {
    const files = collectRouteTsFiles(APIHUB_ROUTES_ROOT);
    const offenders: string[] = [];
    for (const abs of files) {
      const text = fs.readFileSync(abs, "utf8");
      if (/\brequest\.json\s*\(/.test(text) || /\breq\.json\s*\(/.test(text)) {
        offenders.push(path.relative(process.cwd(), abs));
      }
    }
    expect(offenders).toEqual([]);
  });
});
