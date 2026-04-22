import { describe, expect, it } from "vitest";

import { getApiHubHealthJson } from "./health-body";

describe("getApiHubHealthJson", () => {
  it("returns the P2 health contract", () => {
    expect(getApiHubHealthJson()).toEqual({
      ok: true,
      service: "apihub",
      phase: "P2",
    });
  });

  it("exposes only ok, service, phase (R9 — no silent JSON drift on the public health route)", () => {
    const j = getApiHubHealthJson();
    expect(Object.keys(j as Record<string, unknown>).sort()).toEqual(["ok", "phase", "service"]);
  });
});
