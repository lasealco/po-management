import { describe, expect, it } from "vitest";

import { APIHUB_REQUEST_ID_HEADER, resolveApiHubRequestId } from "./request-id";

describe("resolveApiHubRequestId", () => {
  it("echoes a valid x-request-id", () => {
    const id = "client-req-001";
    const request = new Request("http://localhost/", {
      headers: { [APIHUB_REQUEST_ID_HEADER]: id },
    });
    expect(resolveApiHubRequestId(request)).toBe(id);
  });

  it("falls back to x-correlation-id when x-request-id is absent", () => {
    const id = "corr-token-99";
    const request = new Request("http://localhost/", {
      headers: { "x-correlation-id": id },
    });
    expect(resolveApiHubRequestId(request)).toBe(id);
  });

  it("prefers x-request-id over x-correlation-id", () => {
    const request = new Request("http://localhost/", {
      headers: {
        [APIHUB_REQUEST_ID_HEADER]: "primary-id-1",
        "x-correlation-id": "secondary-id-2",
      },
    });
    expect(resolveApiHubRequestId(request)).toBe("primary-id-1");
  });

  it("rejects too-short ids and generates a UUID-shaped value", () => {
    const request = new Request("http://localhost/", {
      headers: { [APIHUB_REQUEST_ID_HEADER]: "short" },
    });
    const resolved = resolveApiHubRequestId(request);
    expect(resolved).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects ids with disallowed characters", () => {
    const request = new Request("http://localhost/", {
      headers: { [APIHUB_REQUEST_ID_HEADER]: "bad id with spaces-123456" },
    });
    const resolved = resolveApiHubRequestId(request);
    expect(resolved.length).toBeGreaterThan(30);
  });
});
