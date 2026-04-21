import { describe, expect, it } from "vitest";

import { API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK } from "./ingestion-apply-rollback-contract";

describe("ingestion-apply-rollback-contract", () => {
  it("exposes a stable stub rollback envelope", () => {
    expect(API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK).toEqual({
      stub: true,
      implemented: false,
      effect: "none",
      message: "Apply rollback is not implemented; no database or downstream changes were made.",
    });
  });
});
