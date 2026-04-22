import { describe, expect, it } from "vitest";

import { TARIFF_AUDIT_LOG_MAX_TAKE } from "./audit-log";

describe("tariff audit log constants", () => {
  it("caps list tail size for contract and object-type queries", () => {
    expect(TARIFF_AUDIT_LOG_MAX_TAKE).toBe(200);
  });
});
