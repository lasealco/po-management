import { beforeEach, describe, expect, it, vi } from "vitest";

import { validateOrgUnitCodeForKind } from "@/lib/org-unit-code-validate";

const findFirst = vi.fn();
const mockPrisma = { referenceCountry: { findFirst } } as unknown as import("@prisma/client").PrismaClient;

describe("validateOrgUnitCodeForKind", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("rejects ad-hoc REGION code", async () => {
    const r = await validateOrgUnitCodeForKind(mockPrisma, "REGION", "ZZ999");
    expect(r.ok).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("accepts EMEA for REGION", async () => {
    const r = await validateOrgUnitCodeForKind(mockPrisma, "REGION", "emea");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code).toBe("EMEA");
  });

  it("validates COUNTRY against ReferenceCountry", async () => {
    findFirst.mockResolvedValueOnce({ id: "x" });
    const r = await validateOrgUnitCodeForKind(mockPrisma, "COUNTRY", "de");
    expect(r.ok).toBe(true);
    expect(findFirst).toHaveBeenCalled();
  });

  it("accepts custom normalized code for SITE", async () => {
    const r = await validateOrgUnitCodeForKind(mockPrisma, "SITE", "MUC-PL-01");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code).toBe("MUC-PL-01");
  });
});
