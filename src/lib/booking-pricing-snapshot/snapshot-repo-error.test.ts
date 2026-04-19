import { describe, expect, it } from "vitest";

import { SnapshotRepoError } from "./snapshot-repo-error";

describe("SnapshotRepoError", () => {
  it("sets name, code, and message", () => {
    const e = new SnapshotRepoError("BAD_INPUT", "Invalid snapshot id");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("SnapshotRepoError");
    expect(e.code).toBe("BAD_INPUT");
    expect(e.message).toBe("Invalid snapshot id");
  });
});
