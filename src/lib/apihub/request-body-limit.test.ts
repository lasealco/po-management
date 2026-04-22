import { describe, expect, it } from "vitest";

import { APIHUB_JSON_BODY_MAX_BYTES } from "@/lib/apihub/constants";
import { parseApiHubRequestJson } from "@/lib/apihub/request-body-limit";

describe("parseApiHubRequestJson", () => {
  it("rejects bodies over maxBytes", async () => {
    const big = "a".repeat(APIHUB_JSON_BODY_MAX_BYTES + 1);
    const req = new Request("http://localhost/test", { method: "POST", body: big });
    const out = await parseApiHubRequestJson(req, APIHUB_JSON_BODY_MAX_BYTES);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("too_large");
    }
  });

  it("parses valid JSON", async () => {
    const req = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });
    const out = await parseApiHubRequestJson(req, APIHUB_JSON_BODY_MAX_BYTES);
    expect(out).toEqual({ ok: true, value: { a: 1 } });
  });

  it("returns empty object for empty body", async () => {
    const req = new Request("http://localhost/test", { method: "POST", body: "" });
    const out = await parseApiHubRequestJson(req, APIHUB_JSON_BODY_MAX_BYTES);
    expect(out).toEqual({ ok: true, value: {} });
  });

  it("emptyOnInvalid yields {} on bad JSON", async () => {
    const req = new Request("http://localhost/test", { method: "POST", body: "not json" });
    const out = await parseApiHubRequestJson(req, APIHUB_JSON_BODY_MAX_BYTES, { emptyOnInvalid: true });
    expect(out).toEqual({ ok: true, value: {} });
  });

  it("invalid JSON without emptyOnInvalid", async () => {
    const req = new Request("http://localhost/test", { method: "POST", body: "not json" });
    const out = await parseApiHubRequestJson(req, APIHUB_JSON_BODY_MAX_BYTES);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("invalid_json");
    }
  });
});
