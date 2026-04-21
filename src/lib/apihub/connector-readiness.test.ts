import { describe, expect, it } from "vitest";

import {
  buildApiHubConnectorReadinessSummary,
  isConnectorAuthReady,
  normalizeConnectorAuthState,
} from "./connector-readiness";

describe("normalizeConnectorAuthState", () => {
  it("lowercases allowlisted values", () => {
    expect(normalizeConnectorAuthState("CONFIGURED")).toBe("configured");
  });

  it("returns unknown for unexpected strings", () => {
    expect(normalizeConnectorAuthState("legacy")).toBe("unknown");
  });
});

describe("isConnectorAuthReady", () => {
  it("treats none mode as ready unless auth is in error", () => {
    expect(
      isConnectorAuthReady({ authMode: "none", authState: "not_configured", authConfigRef: null }),
    ).toBe(true);
    expect(isConnectorAuthReady({ authMode: "none", authState: "error", authConfigRef: null })).toBe(false);
  });

  it("requires configured state and non-empty ref for api_key_ref", () => {
    expect(
      isConnectorAuthReady({
        authMode: "api_key_ref",
        authState: "configured",
        authConfigRef: "vault://x",
      }),
    ).toBe(true);
    expect(
      isConnectorAuthReady({
        authMode: "api_key_ref",
        authState: "configured",
        authConfigRef: "  ",
      }),
    ).toBe(false);
    expect(
      isConnectorAuthReady({
        authMode: "api_key_ref",
        authState: "not_configured",
        authConfigRef: "vault://x",
      }),
    ).toBe(false);
  });
});

describe("buildApiHubConnectorReadinessSummary", () => {
  it("marks stub draft as attention with STATUS_DRAFT", () => {
    const out = buildApiHubConnectorReadinessSummary({
      status: "draft",
      authMode: "none",
      authState: "not_configured",
      authConfigRef: null,
      lastSyncAt: null,
    });
    expect(out.overall).toBe("attention");
    expect(out.reasons).toEqual(["STATUS_DRAFT"]);
    expect(out.authReady).toBe(true);
    expect(out.lifecycleActive).toBe(false);
    expect(out.syncObserved).toBe(false);
  });

  it("marks active + configured auth + ref as ready", () => {
    const out = buildApiHubConnectorReadinessSummary({
      status: "active",
      authMode: "api_key_ref",
      authState: "configured",
      authConfigRef: "vault://tenant/secret",
      lastSyncAt: new Date("2026-04-21T12:00:00.000Z"),
    });
    expect(out.overall).toBe("ready");
    expect(out.reasons).toEqual([]);
    expect(out.authReady).toBe(true);
    expect(out.hasAuthConfigRef).toBe(true);
    expect(out.syncObserved).toBe(true);
  });

  it("marks lifecycle or auth errors as blocked", () => {
    expect(
      buildApiHubConnectorReadinessSummary({
        status: "error",
        authMode: "none",
        authState: "not_configured",
        authConfigRef: null,
        lastSyncAt: null,
      }).overall,
    ).toBe("blocked");
    expect(
      buildApiHubConnectorReadinessSummary({
        status: "active",
        authMode: "oauth_client_ref",
        authState: "error",
        authConfigRef: null,
        lastSyncAt: null,
      }).reasons,
    ).toEqual(["AUTH_ERROR"]);
  });

  it("flags active connector with missing auth as attention", () => {
    const out = buildApiHubConnectorReadinessSummary({
      status: "active",
      authMode: "oauth_client_ref",
      authState: "not_configured",
      authConfigRef: null,
      lastSyncAt: null,
    });
    expect(out.overall).toBe("attention");
    expect(out.reasons).toEqual(["AUTH_INCOMPLETE"]);
  });

  it("uses LIFECYCLE_INACTIVE for non-allowlisted non-active status", () => {
    const out = buildApiHubConnectorReadinessSummary({
      status: "archived",
      authMode: "none",
      authState: "not_configured",
      authConfigRef: null,
      lastSyncAt: null,
    });
    expect(out.overall).toBe("attention");
    expect(out.reasons).toContain("LIFECYCLE_INACTIVE");
  });
});
