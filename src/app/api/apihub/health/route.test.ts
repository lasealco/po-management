import { describe, expect, it } from "vitest";

import { getApiHubHealthJson } from "@/lib/apihub/health-body";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

describe("GET /api/apihub/health", () => {
  it("returns health payload with x-request-id header", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/health", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "health-check-01" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("health-check-01");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual(getApiHubHealthJson());
  });
});
