import { describe, expect, it } from "vitest";

describe("GET /api/apihub/health", () => {
  it("returns API Hub health payload", async () => {
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "apihub",
      phase: "P2",
    });
  });
});
