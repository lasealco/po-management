import { describe, expect, it } from "vitest";

import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";

import { jsonFromRfqError } from "./rfq-api-error";

describe("jsonFromRfqError", () => {
  it("returns null for non-RfqRepoError values", () => {
    expect(jsonFromRfqError(new Error("plain"))).toBeNull();
    expect(jsonFromRfqError(undefined)).toBeNull();
  });

  it.each([
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["BAD_INPUT", 400],
  ] as const)("maps %s to status %s", async (code, expectedStatus) => {
    const res = jsonFromRfqError(new RfqRepoError(code, "msg"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(expectedStatus);
    expect(await res!.json()).toEqual({ error: "msg" });
  });
});
