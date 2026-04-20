import { describe, expect, it } from "vitest";

import { statusFromErrorCode, toApiErrorBody, toApiErrorResponse } from "./api-error-contract";

describe("api-error-contract", () => {
  it("builds a stable error body shape", () => {
    expect(toApiErrorBody("Forbidden", "FORBIDDEN")).toEqual({
      error: "Forbidden",
      code: "FORBIDDEN",
    });
  });

  it("supports additional metadata", () => {
    expect(toApiErrorBody("Schema not ready", "SCHEMA_NOT_READY", { migrationsHint: "run db:migrate" })).toEqual({
      error: "Schema not ready",
      code: "SCHEMA_NOT_READY",
      migrationsHint: "run db:migrate",
    });
  });

  it("returns NextResponse with requested status", async () => {
    const res = toApiErrorResponse({ error: "Missing", code: "NOT_FOUND", status: 404 });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Missing", code: "NOT_FOUND" });
  });

  it("maps known codes and falls back to default status", () => {
    expect(statusFromErrorCode("NOT_FOUND", { NOT_FOUND: 404 }, 400)).toBe(404);
    expect(statusFromErrorCode("UNKNOWN", { UNKNOWN: 422 }, 400)).toBe(422);
    expect(statusFromErrorCode("UNKNOWN", {}, 400)).toBe(400);
  });
});
