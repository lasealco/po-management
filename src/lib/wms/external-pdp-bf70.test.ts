import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateExternalWmsPolicy,
  externalPdpBf70DashboardMeta,
  sanitizeWmsBodyForExternalPdp,
} from "./external-pdp-bf70";

const prevUrl = process.env.WMS_EXTERNAL_PDP_URL;
const prevTimeout = process.env.WMS_EXTERNAL_PDP_TIMEOUT_MS;
const prevFailOpen = process.env.WMS_EXTERNAL_PDP_FAIL_OPEN;

afterEach(() => {
  process.env.WMS_EXTERNAL_PDP_URL = prevUrl;
  process.env.WMS_EXTERNAL_PDP_TIMEOUT_MS = prevTimeout;
  process.env.WMS_EXTERNAL_PDP_FAIL_OPEN = prevFailOpen;
});

function startPdpServer(
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

describe("sanitizeWmsBodyForExternalPdp", () => {
  it("drops signingSecret-style keys", () => {
    const o = sanitizeWmsBodyForExternalPdp({
      action: "x",
      signingSecret: "sekret",
      webhookSigningSecret: "nope",
      ok: 1,
    });
    expect(o.ok).toBe(1);
    expect(o.signingSecret).toBeUndefined();
    expect(o.webhookSigningSecret).toBeUndefined();
  });
});

describe("externalPdpBf70DashboardMeta", () => {
  it("reflects env without exposing URL", () => {
    delete process.env.WMS_EXTERNAL_PDP_URL;
    const m = externalPdpBf70DashboardMeta();
    expect(m.enabled).toBe(false);
    process.env.WMS_EXTERNAL_PDP_URL = "http://127.0.0.1:9";
    expect(externalPdpBf70DashboardMeta().enabled).toBe(true);
  });
});

describe("evaluateExternalWmsPolicy", () => {
  it("allows when URL unset", async () => {
    delete process.env.WMS_EXTERNAL_PDP_URL;
    const r = await evaluateExternalWmsPolicy({
      tenantId: "t1",
      actorUserId: "u1",
      action: "complete_pick_task",
      body: { taskId: "abc" },
    });
    expect(r).toEqual({ ok: true });
  });

  it("posts bf70.v1 payload and respects allow: true", async () => {
    let received: unknown;
    const { baseUrl, close } = await startPdpServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ allow: true }));
      });
    });
    process.env.WMS_EXTERNAL_PDP_URL = `${baseUrl}/policy`;
    process.env.WMS_EXTERNAL_PDP_TIMEOUT_MS = "5000";

    const r = await evaluateExternalWmsPolicy({
      tenantId: "ten",
      actorUserId: "act",
      action: "mark_outbound_shipped",
      body: { outboundOrderId: "o1" },
    });
    await close();

    expect(r).toEqual({ ok: true });
    expect(received).toMatchObject({
      schemaVersion: "bf70.v1",
      tenantId: "ten",
      actorUserId: "act",
      action: "mark_outbound_shipped",
      body: { outboundOrderId: "o1" },
    });
  });

  it("returns 403 when PDP sets allow: false", async () => {
    const { baseUrl, close } = await startPdpServer((_, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ allow: false, reason: "Weekend freeze." }));
    });
    process.env.WMS_EXTERNAL_PDP_URL = baseUrl;

    const r = await evaluateExternalWmsPolicy({
      tenantId: "t",
      actorUserId: "u",
      action: "release_wave",
      body: {},
    });
    await close();

    expect(r).toEqual({
      ok: false,
      httpStatus: 403,
      message: "Weekend freeze.",
    });
  });

  it("fail-open on timeout when WMS_EXTERNAL_PDP_FAIL_OPEN=1", async () => {
    const { baseUrl, close } = await startPdpServer((_, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ allow: true }));
      }, 10_000);
    });
    process.env.WMS_EXTERNAL_PDP_URL = baseUrl;
    process.env.WMS_EXTERNAL_PDP_TIMEOUT_MS = "30";
    process.env.WMS_EXTERNAL_PDP_FAIL_OPEN = "1";

    const r = await evaluateExternalWmsPolicy({
      tenantId: "t",
      actorUserId: "u",
      action: "x",
      body: {},
    });
    await close();

    expect(r).toEqual({ ok: true });
  });
});
