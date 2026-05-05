import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildDeniedPartyScreeningPayloadBf92,
  deniedPartyScreeningBf92DashboardMeta,
  evaluateDeniedPartyScreeningBf92,
} from "./denied-party-screening-bf92";

const prevUrl = process.env.WMS_DENIED_PARTY_SCREENING_URL;
const prevTimeout = process.env.WMS_DENIED_PARTY_SCREENING_TIMEOUT_MS;
const prevFailOpen = process.env.WMS_DENIED_PARTY_SCREENING_FAIL_OPEN;
const prevBearer = process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN;

afterEach(() => {
  process.env.WMS_DENIED_PARTY_SCREENING_URL = prevUrl;
  process.env.WMS_DENIED_PARTY_SCREENING_TIMEOUT_MS = prevTimeout;
  process.env.WMS_DENIED_PARTY_SCREENING_FAIL_OPEN = prevFailOpen;
  process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN = prevBearer;
});

function startScreeningServer(
  responder: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const s = http.createServer(responder);
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a && "port" in a ? a.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r, rej) => {
            s.close((err) => (err ? rej(err) : r()));
          }),
      });
    });
  });
}

const sampleOrder = {
  id: "oid",
  outboundNo: "OB-1",
  warehouseId: "wh",
  customerRef: "PO-99",
  shipToName: "Acme DC",
  shipToLine1: "1 Main St",
  shipToCity: "Chicago",
  shipToCountryCode: "us",
  crmAccount: { id: "crm1", name: "Acme Holdings", legalName: "Acme Holdings LLC" },
};

describe("buildDeniedPartyScreeningPayloadBf92", () => {
  it("includes ship-to and CRM parties", () => {
    const p = buildDeniedPartyScreeningPayloadBf92({
      tenantId: "t1",
      actorUserId: "u1",
      order: sampleOrder,
    });
    expect(p.schemaVersion).toBe("bf92.v1");
    expect(p.action).toBe("mark_outbound_shipped");
    expect(p.parties.some((x) => x.role === "SHIP_TO")).toBe(true);
    expect(p.parties.some((x) => x.role === "CRM_ACCOUNT")).toBe(true);
    expect(p.parties.find((x) => x.role === "SHIP_TO")?.countryCode).toBe("US");
  });

  it("omits empty ship-to party when no ship fields", () => {
    const p = buildDeniedPartyScreeningPayloadBf92({
      tenantId: "t1",
      actorUserId: "u1",
      order: {
        ...sampleOrder,
        shipToName: null,
        shipToLine1: null,
        shipToCity: null,
        shipToCountryCode: null,
        crmAccount: null,
      },
    });
    expect(p.parties.length).toBe(0);
  });
});

describe("evaluateDeniedPartyScreeningBf92", () => {
  it("allows when URL unset", async () => {
    delete process.env.WMS_DENIED_PARTY_SCREENING_URL;
    const payload = buildDeniedPartyScreeningPayloadBf92({
      tenantId: "t1",
      actorUserId: "u1",
      order: sampleOrder,
    });
    await expect(evaluateDeniedPartyScreeningBf92(payload)).resolves.toEqual({ ok: true });
  });

  it("honours allow: false", async () => {
    const srv = await startScreeningServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ allow: false, reason: "blocked list" }));
    });
    try {
      process.env.WMS_DENIED_PARTY_SCREENING_URL = srv.baseUrl;
      process.env.WMS_DENIED_PARTY_SCREENING_FAIL_OPEN = "0";
      const payload = buildDeniedPartyScreeningPayloadBf92({
        tenantId: "t1",
        actorUserId: "u1",
        order: sampleOrder,
      });
      const r = await evaluateDeniedPartyScreeningBf92(payload);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.httpStatus).toBe(403);
        expect(r.message).toContain("blocked");
      }
    } finally {
      await srv.close();
    }
  });

  it("fail-open on HTTP error when configured", async () => {
    process.env.WMS_DENIED_PARTY_SCREENING_URL = "http://127.0.0.1:1";
    process.env.WMS_DENIED_PARTY_SCREENING_FAIL_OPEN = "1";
    const payload = buildDeniedPartyScreeningPayloadBf92({
      tenantId: "t1",
      actorUserId: "u1",
      order: sampleOrder,
    });
    await expect(evaluateDeniedPartyScreeningBf92(payload)).resolves.toEqual({ ok: true });
  });
});

describe("deniedPartyScreeningBf92DashboardMeta", () => {
  it("reflects env configuration without leaking secrets", () => {
    process.env.WMS_DENIED_PARTY_SCREENING_URL = "";
    process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN = "";
    let m = deniedPartyScreeningBf92DashboardMeta();
    expect(m.enabled).toBe(false);
    expect(m.bearerConfigured).toBe(false);

    process.env.WMS_DENIED_PARTY_SCREENING_URL = "https://example.invalid/screen";
    process.env.WMS_DENIED_PARTY_SCREENING_BEARER_TOKEN = "secret";
    m = deniedPartyScreeningBf92DashboardMeta();
    expect(m.enabled).toBe(true);
    expect(m.bearerConfigured).toBe(true);
    expect(JSON.stringify(m)).not.toContain("secret");
  });
});
