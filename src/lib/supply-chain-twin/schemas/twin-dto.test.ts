import { describe, expect, it } from "vitest";

import { twinEdgeDtoSchema, twinEntityDtoSchema } from "./twin-dto";

describe("twin dto nullability", () => {
  it("accepts omitted or null provenance fields for entity dto", () => {
    expect(
      twinEntityDtoSchema.parse({
        kind: "supplier",
        id: "SUP-001",
      }),
    ).toEqual({
      kind: "supplier",
      id: "SUP-001",
    });

    expect(
      twinEntityDtoSchema.parse({
        kind: "supplier",
        id: "SUP-001",
        sourceSystem: null,
        sourceRef: null,
      }),
    ).toEqual({
      kind: "supplier",
      id: "SUP-001",
      sourceSystem: null,
      sourceRef: null,
    });
  });

  it("accepts omitted or null optional fields for edge dto", () => {
    expect(
      twinEdgeDtoSchema.parse({
        from: { kind: "supplier", id: "SUP-001" },
        to: { kind: "warehouse", id: "WH-001" },
      }),
    ).toEqual({
      from: { kind: "supplier", id: "SUP-001" },
      to: { kind: "warehouse", id: "WH-001" },
    });

    expect(
      twinEdgeDtoSchema.parse({
        from: { kind: "supplier", id: "SUP-001" },
        to: { kind: "warehouse", id: "WH-001" },
        relation: null,
        sourceSystem: null,
        sourceRef: null,
      }),
    ).toEqual({
      from: { kind: "supplier", id: "SUP-001" },
      to: { kind: "warehouse", id: "WH-001" },
      relation: null,
      sourceSystem: null,
      sourceRef: null,
    });
  });

  it("rejects empty provenance strings", () => {
    const parsed = twinEntityDtoSchema.safeParse({
      kind: "supplier",
      id: "SUP-001",
      sourceSystem: "",
    });
    expect(parsed.success).toBe(false);
  });
});
