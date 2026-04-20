import { describe, expect, it } from "vitest";

import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

import { jsonFromSnapshotError } from "./snapshot-api-error";

describe("jsonFromSnapshotError", () => {
  it("returns null for non-SnapshotRepoError values", () => {
    expect(jsonFromSnapshotError(new Error("plain"))).toBeNull();
    expect(jsonFromSnapshotError(null)).toBeNull();
  });

  it.each([
    ["NOT_FOUND", 404],
    ["FORBIDDEN", 403],
    ["BAD_INPUT", 400],
  ] as const)("maps %s to status %s", async (code, expectedStatus) => {
    const res = jsonFromSnapshotError(new SnapshotRepoError(code, "msg"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(expectedStatus);
    expect(await res!.json()).toEqual({ error: "msg", code });
  });
});
