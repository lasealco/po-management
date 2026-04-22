import { describe, expect, it } from "vitest";

import { APIHUB_JSON_BODY_MAX_BYTES, APIHUB_JSON_BODY_MAX_BYTES_LARGE } from "@/lib/apihub/constants";

import { apiHubJsonBodyMaxBytes, parseApiHubRequestJsonWithBudget } from "./request-budget";

describe("request-budget", () => {
  it("maps tiers to constants", () => {
    expect(apiHubJsonBodyMaxBytes("standard")).toBe(APIHUB_JSON_BODY_MAX_BYTES);
    expect(apiHubJsonBodyMaxBytes("large")).toBe(APIHUB_JSON_BODY_MAX_BYTES_LARGE);
  });

  it("parseApiHubRequestJsonWithBudget enforces tier size", async () => {
    const big = "a".repeat(APIHUB_JSON_BODY_MAX_BYTES + 1);
    const req = new Request("http://localhost", { method: "POST", body: big });
    const out = await parseApiHubRequestJsonWithBudget(req, "standard");
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("expected failure");
    expect(out.reason).toBe("too_large");
  });
});
