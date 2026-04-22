import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const TARIFF_API_ROUTES_ROOT = path.join(process.cwd(), "src/app/api/tariffs");

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

/**
 * Bump when adding or removing `route.ts` under `src/app/api/tariffs`.
 * Sync: `docs/engineering/tariff-engine/API_ROUTE_INDEX.md`.
 */
const TARIFF_API_ROUTE_TS_EXPECTED_COUNT = 29;

const TARIFF_LIB_DIR = path.join(process.cwd(), "src/lib/tariff");

function listNonTestTariffLibModules(): string[] {
  return fs
    .readdirSync(TARIFF_LIB_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort();
}

/**
 * Bump when adding or removing non-test `*.ts` in `src/lib/tariff` (flat directory).
 * Sync: `docs/engineering/tariff-engine/LIB_MODULE_INDEX.md`.
 */
const TARIFF_LIB_MODULE_EXPECTED_COUNT = 32;

describe("tariffs API route surface (conformance)", () => {
  it("tracks route.ts count under src/app/api/tariffs", () => {
    const files = collectRouteTsFiles(TARIFF_API_ROUTES_ROOT);
    expect(files).toHaveLength(TARIFF_API_ROUTE_TS_EXPECTED_COUNT);
  });
});

describe("tariffs lib surface (conformance)", () => {
  it("tracks non-test .ts module count under src/lib/tariff", () => {
    const modules = listNonTestTariffLibModules();
    expect(modules).toHaveLength(TARIFF_LIB_MODULE_EXPECTED_COUNT);
  });
});
