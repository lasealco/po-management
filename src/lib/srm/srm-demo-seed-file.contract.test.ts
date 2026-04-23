import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase F (slice 29): lock key markers in `prisma/seed-srm-demo.mjs` without running DB.
 * If this fails, update the seed script and this contract together.
 */
describe("SRM demo seed file contract (prisma/seed-srm-demo.mjs)", () => {
  const seedPath = path.join(process.cwd(), "prisma/seed-srm-demo.mjs");
  const src = readFileSync(seedPath, "utf8");

  it("retains five DEMO-SRM-00x supplier codes in SUPPLIERS", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(src).toContain(`"DEMO-SRM-00${n}"`);
    }
  });

  it("declares SRM document filename marker and demo-company tenant", () => {
    expect(src).toContain("srm-demo-seed");
    expect(src).toContain("demo-company");
    expect(src).toContain("buyer@demo-company.com");
  });

  it("matches npm script name in log output", () => {
    expect(src).toContain("db:seed:srm-demo");
  });
});

describe("package.json SRM demo seed script", () => {
  it("wires db:seed:srm-demo to seed-srm-demo.mjs", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["db:seed:srm-demo"]).toMatch(/seed-srm-demo\.mjs/);
  });
});
