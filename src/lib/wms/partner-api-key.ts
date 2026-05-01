/**
 * BF-45 — partner API keys: opaque bearer tokens, SHA-256 hash at rest.
 */

import { createHash, randomBytes } from "node:crypto";

import type { WmsPartnerApiKeyScope } from "@prisma/client";

export const WMS_PARTNER_API_KEY_PREFIX = "wmsp_live_";

export const WMS_PARTNER_API_SCOPES: readonly WmsPartnerApiKeyScope[] = [
  "INVENTORY_READ",
  "OUTBOUND_READ",
];

export function generatePartnerApiKeyPlaintext(): string {
  return WMS_PARTNER_API_KEY_PREFIX + randomBytes(24).toString("base64url");
}

export function hashPartnerApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function partnerApiKeyPublicPrefix(plaintext: string): string {
  const t = plaintext.trim();
  return t.length <= 24 ? t : `${t.slice(0, 24)}`;
}

export function parsePartnerApiKeyScopes(raw: unknown): WmsPartnerApiKeyScope[] {
  const allowed = new Set<string>(WMS_PARTNER_API_SCOPES);
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: WmsPartnerApiKeyScope[] = [];
  for (const x of raw) {
    const s = String(x).trim().toUpperCase();
    if (allowed.has(s)) out.push(s as WmsPartnerApiKeyScope);
  }
  return [...new Set(out)];
}
