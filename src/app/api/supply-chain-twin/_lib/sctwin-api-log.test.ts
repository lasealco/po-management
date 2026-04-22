import { describe, expect, it, vi } from "vitest";

import {
  isSafeSctwinRequestId,
  logSctwinApiError,
  logSctwinApiWarn,
  resolveSctwinRequestId,
  SCTWIN_MODULE_REQUEST_ID_HEADER,
  SCTWIN_REQUEST_ID_HEADER,
  twinApiErrorJson,
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

describe("twinApiErrorJson", () => {
  it("includes error + code from status and sets request id headers", async () => {
    const res = twinApiErrorJson("nope", 404, "gateway-req-err1");
    expect(res.headers.get(SCTWIN_REQUEST_ID_HEADER)).toBe("gateway-req-err1");
    await expect(res.json()).resolves.toEqual({ error: "nope", code: "NOT_FOUND" });
  });

  it("allows overriding the machine code", async () => {
    const res = twinApiErrorJson("bad cursor", 400, "gateway-req-err2", "INVALID_CURSOR");
    await expect(res.json()).resolves.toEqual({ error: "bad cursor", code: "INVALID_CURSOR" });
  });
});

describe("structured log normalization", () => {
  it("normalizes warn payload fields with default tenant scope", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      logSctwinApiWarn({
        route: "GET /api/supply-chain-twin/entities",
        phase: "validation",
        errorCode: "INVALID_CURSOR",
        requestId: "gateway-req-3001",
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<string, unknown>;
      expect(payload.route).toBe("GET /api/supply-chain-twin/entities");
      expect(payload.requestId).toBe("gateway-req-3001");
      expect(payload.errorClass).toBe("validation");
      expect(payload.tenantScope).toBe("tenant:unknown");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("normalizes error payload fields with safe tenant scope", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      logSctwinApiError({
        route: "PATCH /api/supply-chain-twin/scenarios/[id]",
        phase: "scenarios",
        errorCode: "UNHANDLED_EXCEPTION",
        requestId: "gateway-req-3002",
        tenantScope: "Tenant/Enterprise One",
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(errorSpy.mock.calls[0][0])) as Record<string, unknown>;
      expect(payload.route).toBe("PATCH /api/supply-chain-twin/scenarios/[id]");
      expect(payload.requestId).toBe("gateway-req-3002");
      expect(payload.errorClass).toBe("internal");
      expect(payload.tenantScope).toBe("tenant-enterprise-one");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
