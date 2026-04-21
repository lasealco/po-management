import { describe, expect, it, vi } from "vitest";

import {
  isSafeSctwinRequestId,
  resolveSctwinRequestId,
  SCTWIN_MODULE_REQUEST_ID_HEADER,
  SCTWIN_REQUEST_ID_HEADER,
  twinApiJson,
} from "./sctwin-api-log";

describe("isSafeSctwinRequestId", () => {
  it("accepts uuid-like values", () => {
    expect(isSafeSctwinRequestId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects too short or unsafe characters", () => {
    expect(isSafeSctwinRequestId("abc")).toBe(false);
    expect(isSafeSctwinRequestId('bad"id')).toBe(false);
    expect(isSafeSctwinRequestId("a\nb")).toBe(false);
  });
});

describe("resolveSctwinRequestId", () => {
  it("uses x-request-id when valid", () => {
    const req = new Request("http://localhost/", {
      headers: { [SCTWIN_REQUEST_ID_HEADER]: "client-req-0001" },
    });
    expect(resolveSctwinRequestId(req)).toBe("client-req-0001");
  });

  it("falls back to x-correlation-id", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-correlation-id": "corr-0002-extra" },
    });
    expect(resolveSctwinRequestId(req)).toBe("corr-0002-extra");
  });

  it("generates uuid when header missing or invalid", () => {
    const uuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("ffffffff-ffff-4fff-bfff-ffffffffffff");
    try {
      expect(resolveSctwinRequestId(new Request("http://localhost/"))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
      const bad = new Request("http://localhost/", { headers: { "x-request-id": "no spaces allowed" } });
      expect(resolveSctwinRequestId(bad)).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    } finally {
      uuidSpy.mockRestore();
    }
  });
});

describe("twinApiJson", () => {
  it("sets x-request-id and x-sctwin-request-id to the same resolved id", async () => {
    const res = twinApiJson({ ok: true }, { status: 200 }, "gateway-req-abc12");
    expect(res.headers.get(SCTWIN_REQUEST_ID_HEADER)).toBe("gateway-req-abc12");
    expect(res.headers.get(SCTWIN_MODULE_REQUEST_ID_HEADER)).toBe("gateway-req-abc12");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
