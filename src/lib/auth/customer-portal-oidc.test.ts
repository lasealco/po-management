import { describe, expect, it } from "vitest";

import {
  generatePkceVerifier,
  openOidcCookiePayload,
  pkceChallengeS256,
  sealOidcCookiePayload,
} from "./customer-portal-oidc";

describe("BF-46 customer portal OIDC helpers", () => {
  it("derives deterministic PKCE S256 challenge", () => {
    const challenge = pkceChallengeS256("test-verifier-constant");
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkceChallengeS256("test-verifier-constant")).toBe(challenge);
  });

  it("generates URL-safe PKCE verifiers", () => {
    const v = generatePkceVerifier();
    expect(v.length).toBeGreaterThan(40);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("round-trips sealed OIDC cookie payloads", () => {
    const secret = "x".repeat(32);
    const now = Date.now();
    const payload = {
      st: "state1",
      nv: "nonce1",
      cv: "verifier1",
      exp: now + 60_000,
    };
    const sealed = sealOidcCookiePayload(secret, payload);
    expect(openOidcCookiePayload(secret, sealed)).toEqual(payload);
    expect(openOidcCookiePayload(`${secret}!`, sealed)).toBeNull();
  });

  it("rejects expired cookie payloads", () => {
    const secret = "y".repeat(32);
    const sealed = sealOidcCookiePayload(secret, {
      st: "a",
      nv: "b",
      cv: "c",
      exp: Date.now() - 1000,
    });
    expect(openOidcCookiePayload(secret, sealed)).toBeNull();
  });
});
