import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("srm-operator-notification-email-mirror", () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("send returns false when flag is off", async () => {
    delete process.env.SRM_OPERATOR_EMAIL_NOTIFICATIONS;
    const { sendSrmOperatorNotificationEmailMirror } = await import(
      "./srm-operator-notification-email-mirror"
    );
    const r = await sendSrmOperatorNotificationEmailMirror({
      to: "a@x.com",
      title: "T",
      body: "B",
    });
    expect(r).toBe(false);
  });

  it("sends when flag and Resend env are set", async () => {
    process.env.SRM_OPERATOR_EMAIL_NOTIFICATIONS = "1";
    process.env.RESEND_API_KEY = "re_key";
    process.env.SRM_EMAIL_FROM = "noreply@example.com";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { sendSrmOperatorNotificationEmailMirror } = await import(
      "./srm-operator-notification-email-mirror"
    );
    const r = await sendSrmOperatorNotificationEmailMirror({
      to: "u@x.com",
      title: "Hello",
      body: "World",
    });
    expect(r).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body as string) as { to: string[]; from: string; text: string };
    expect(body.to).toEqual(["u@x.com"]);
    expect(body.from).toBe("noreply@example.com");
    expect(body.text).toContain("Hello");
  });

  it("includes a From: line when actorName is set", async () => {
    process.env.SRM_OPERATOR_EMAIL_NOTIFICATIONS = "1";
    process.env.RESEND_API_KEY = "re_key";
    process.env.SRM_EMAIL_FROM = "noreply@example.com";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { sendSrmOperatorNotificationEmailMirror } = await import(
      "./srm-operator-notification-email-mirror"
    );
    const r = await sendSrmOperatorNotificationEmailMirror({
      to: "u@x.com",
      title: "Hello",
      body: "World",
      actorName: "Pat",
    });
    expect(r).toBe(true);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const b = JSON.parse(init.body as string) as { text: string };
    expect(b.text).toContain("From: Pat");
  });

  it("includes a Supplier: line when name or code is set", async () => {
    process.env.SRM_OPERATOR_EMAIL_NOTIFICATIONS = "1";
    process.env.RESEND_API_KEY = "re_key";
    process.env.SRM_EMAIL_FROM = "noreply@example.com";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { sendSrmOperatorNotificationEmailMirror } = await import(
      "./srm-operator-notification-email-mirror"
    );
    const r = await sendSrmOperatorNotificationEmailMirror({
      to: "u@x.com",
      title: "T",
      body: null,
      supplierName: "Acme",
      supplierCode: "S-99",
    });
    expect(r).toBe(true);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const b = JSON.parse(init.body as string) as { text: string };
    expect(b.text).toContain("Supplier: Acme (S-99)");
  });
});
