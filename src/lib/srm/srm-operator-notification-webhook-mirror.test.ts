import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("srm-operator-notification-webhook-mirror", () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("getSrmOperatorWebhookUrl returns null when unset", async () => {
    delete process.env.SRM_OPERATOR_WEBHOOK_URL;
    const { getSrmOperatorWebhookUrl, postSrmOperatorNotificationWebhook } = await import(
      "./srm-operator-notification-webhook-mirror"
    );
    expect(getSrmOperatorWebhookUrl()).toBeNull();
    const r = await postSrmOperatorNotificationWebhook({
      id: "n1",
      tenantId: "t1",
      userId: "u1",
      kind: "K",
      title: "T",
      body: "b",
      supplierId: null,
      supplierName: null,
      supplierCode: null,
      taskId: null,
      actorUserId: null,
      actorName: null,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect(r).toBe(false);
  });

  it("rejects non-http(s) URL", async () => {
    process.env.SRM_OPERATOR_WEBHOOK_URL = "ftp://x.example/hook";
    const { getSrmOperatorWebhookUrl } = await import(
      "./srm-operator-notification-webhook-mirror"
    );
    expect(getSrmOperatorWebhookUrl()).toBeNull();
  });

  it("POSTs JSON with optional secret header when URL is set", async () => {
    process.env.SRM_OPERATOR_WEBHOOK_URL = "https://hooks.example.com/srm";
    process.env.SRM_OPERATOR_WEBHOOK_SECRET = "shh";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { postSrmOperatorNotificationWebhook } = await import(
      "./srm-operator-notification-webhook-mirror"
    );
    const r = await postSrmOperatorNotificationWebhook({
      id: "nid",
      tenantId: "tid",
      userId: "uid",
      kind: "ONBOARDING_TASK_ASSIGNED",
      title: "You were assigned",
      body: "Task body",
      supplierId: "s1",
      supplierName: "Acme",
      supplierCode: "AC-1",
      taskId: "k1",
      actorUserId: "a1",
      actorName: "Alex",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect(r).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/srm");
    const h = init.headers as Record<string, string>;
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["X-SRM-Webhook-Secret"]).toBe("shh");
    const body = JSON.parse(init.body as string) as {
      specVersion: 1;
      event: string;
      notification: {
        id: string;
        kind: string;
        actorName: string | null;
        supplierName: string | null;
        supplierCode: string | null;
      };
    };
    expect(body.specVersion).toBe(1);
    expect(body.event).toBe("srm.operator_notification.created");
    expect(body.notification.id).toBe("nid");
    expect(body.notification.kind).toBe("ONBOARDING_TASK_ASSIGNED");
    expect(body.notification.actorName).toBe("Alex");
    expect(body.notification.supplierName).toBe("Acme");
    expect(body.notification.supplierCode).toBe("AC-1");
  });
});
