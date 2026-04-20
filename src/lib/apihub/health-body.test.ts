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
});
