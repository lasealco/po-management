import { describe, expect, it } from "vitest";

import { RfqRepoError } from "./rfq-repo-error";

describe("RfqRepoError", () => {
  it("sets name, code, and message", () => {
    const e = new RfqRepoError("BAD_INPUT", "Invalid payload");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("RfqRepoError");
    expect(e.code).toBe("BAD_INPUT");
    expect(e.message).toBe("Invalid payload");
  });
});
