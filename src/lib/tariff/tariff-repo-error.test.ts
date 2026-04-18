import { describe, expect, it } from "vitest";

import { TariffRepoError } from "./tariff-repo-error";

describe("TariffRepoError", () => {
  it("sets name, code, and message", () => {
    const e = new TariffRepoError("NOT_FOUND", "Missing row");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("TariffRepoError");
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("Missing row");
  });
});
