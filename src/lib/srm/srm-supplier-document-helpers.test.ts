import { describe, expect, it } from "vitest";

import { computeSrmDocExpirySignal } from "./srm-supplier-document-helpers";

describe("computeSrmDocExpirySignal", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns none when no expiry", () => {
    expect(computeSrmDocExpirySignal(null, now)).toBe("none");
  });

  it("returns expired when past", () => {
    expect(computeSrmDocExpirySignal(new Date("2026-05-01T12:00:00.000Z"), now)).toBe("expired");
  });

  it("returns expiring_soon within 30 days", () => {
    expect(computeSrmDocExpirySignal(new Date("2026-06-20T12:00:00.000Z"), now)).toBe("expiring_soon");
  });

  it("returns ok when beyond 30 days", () => {
    expect(computeSrmDocExpirySignal(new Date("2026-08-01T12:00:00.000Z"), now)).toBe("ok");
  });
});
