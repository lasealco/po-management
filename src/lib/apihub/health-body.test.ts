import { describe, expect, it } from "vitest";

import { getApiHubHealthJson } from "./health-body";

describe("getApiHubHealthJson", () => {
  it("returns the API Hub health contract", () => {
    expect(getApiHubHealthJson()).toEqual({
      ok: true,
      service: "apihub",
      phase: "P2",
    });
  });
});
