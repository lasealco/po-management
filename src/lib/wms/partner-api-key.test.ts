import { describe, expect, it } from "vitest";

import {
  generatePartnerApiKeyPlaintext,
  hashPartnerApiKey,
  parsePartnerApiKeyScopes,
  WMS_PARTNER_API_KEY_PREFIX,
} from "./partner-api-key";

describe("BF-45 partner API keys", () => {
  it("generates prefixed opaque keys", () => {
    const a = generatePartnerApiKeyPlaintext();
    const b = generatePartnerApiKeyPlaintext();
    expect(a.startsWith(WMS_PARTNER_API_KEY_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThan(WMS_PARTNER_API_KEY_PREFIX.length + 8);
    expect(a).not.toBe(b);
  });

  it("hashes deterministically for lookup", () => {
    const k = `${WMS_PARTNER_API_KEY_PREFIX}test`;
    expect(hashPartnerApiKey(k)).toBe(hashPartnerApiKey(k));
    expect(hashPartnerApiKey(k)).not.toBe(hashPartnerApiKey(`${k}x`));
  });

  it("parses scopes with dedupe", () => {
    expect(parsePartnerApiKeyScopes(["inventory_read", "OUTBOUND_READ", "nope"])).toEqual([
      "INVENTORY_READ",
      "OUTBOUND_READ",
    ]);
    expect(
      parsePartnerApiKeyScopes(["INBOUND_ASN_ADVISE_WRITE", "INBOUND_ASN_ADVISE_WRITE", "inventory_read"]),
    ).toEqual(["INBOUND_ASN_ADVISE_WRITE", "INVENTORY_READ"]);
  });
});
