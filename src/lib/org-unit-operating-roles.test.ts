import { describe, expect, it } from "vitest";

import { formatOperatingRolesShort, parseOperatingRolesInput } from "@/lib/org-unit-operating-roles";

describe("parseOperatingRolesInput", () => {
  it("accepts empty and dedupes", () => {
    const a = parseOperatingRolesInput(["PLANT", "PLANT", "R_AND_D"]);
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.roles).toEqual(["PLANT", "R_AND_D"]);
  });

  it("rejects unknown code", () => {
    const a = parseOperatingRolesInput(["NOT_A_ROLE"]);
    expect(a.ok).toBe(false);
  });

  it("treats undefined as empty for convenience callers", () => {
    const a = parseOperatingRolesInput(undefined);
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.roles).toEqual([]);
  });
});

describe("formatOperatingRolesShort", () => {
  it("shows dash for empty", () => {
    expect(formatOperatingRolesShort([])).toBe("—");
  });
});
