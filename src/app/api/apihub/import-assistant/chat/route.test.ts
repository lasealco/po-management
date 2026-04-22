import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({
  getActorUserId: getActorUserIdMock,
  userHasGlobalGrant: vi.fn().mockResolvedValue(true),
}));

describe("POST /api/apihub/import-assistant/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1", name: "Demo", slug: "demo-company" });
    getActorUserIdMock.mockResolvedValue("user-1");
    delete process.env.APIHUB_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("returns validation error when messages missing", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/import-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "chat-test-1",
        },
        body: JSON.stringify({ context: { step: "domain" } }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns fallback assistant text when no OpenAI key", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/import-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "chat-test-fallback",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello?" }],
          context: { step: "domain" },
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      assistantMessage: string;
      fallback: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.fallback).toBe(true);
    expect(body.assistantMessage).toMatch(/OpenAI API key/i);
  });

  it("returns assistant message when OpenAI responds", async () => {
    process.env.APIHUB_OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Pick the purpose that best matches your file, then upload a sample." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/import-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "chat-test-2",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "What should I do first?" }],
          context: { step: "domain", statedDomainTitle: "Shipments" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      assistantMessage: string;
      fallback?: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.fallback).toBeFalsy();
    expect(body.assistantMessage).toContain("purpose");
  });
});
