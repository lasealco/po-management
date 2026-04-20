import { describe, expect, it } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

import { jsonFromTariffError, toTariffApiErrorBody } from "./tariff-api-error";

describe("jsonFromTariffError", () => {
  it("builds stable API error bodies", () => {
    expect(toTariffApiErrorBody("oops", "BAD_INPUT")).toEqual({ error: "oops", code: "BAD_INPUT" });
  });

  it("returns null for non-TariffRepoError values", () => {
    expect(jsonFromTariffError(new Error("plain"))).toBeNull();
    expect(jsonFromTariffError("string")).toBeNull();
    expect(jsonFromTariffError(null)).toBeNull();
  });

  it.each([
    ["NOT_FOUND", 404],
    ["BAD_INPUT", 400],
    ["TENANT_MISMATCH", 403],
    ["VERSION_FROZEN", 409],
    ["CONFLICT", 409],
  ] as const)("maps %s to status %s", async (code, expectedStatus) => {
    const res = jsonFromTariffError(new TariffRepoError(code, "msg"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(expectedStatus);
    expect(await res!.json()).toEqual({ error: "msg", code });
  });
});
