import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT } from "@/lib/apihub/constants";
import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const listApiHubMappingTemplatesMock = vi.fn();
const createApiHubMappingTemplateMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/mapping-templates-repo", () => ({
  listApiHubMappingTemplates: listApiHubMappingTemplatesMock,
  createApiHubMappingTemplate: createApiHubMappingTemplateMock,
}));

describe("GET /api/apihub/mapping-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 400 for invalid limit", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates?limit=not-a-number", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-list-bad-limit" },
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("mtpl-list-bad-limit");
  });

  it("lists templates for tenant", async () => {
    const createdAt = new Date("2026-04-22T12:00:00.000Z");
    const updatedAt = new Date("2026-04-22T12:00:00.000Z");
    listApiHubMappingTemplatesMock.mockResolvedValue([
      {
        id: "tpl-1",
        tenantId: "tenant-1",
        name: "Shipment A",
        description: null,
        rules: [{ sourcePath: "a", targetField: "b", transform: "trim" }],
        createdByUserId: "user-1",
        createdAt,
        updatedAt,
      },
    ]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates?limit=10", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-list-ok" },
      }),
    );
    expect(response.status).toBe(200);
    expect(listApiHubMappingTemplatesMock).toHaveBeenCalledWith("tenant-1", 10);
    expect(await response.json()).toEqual({
      templates: [
        {
          id: "tpl-1",
          name: "Shipment A",
          description: null,
          rules: [{ sourcePath: "a", targetField: "b", transform: "trim", required: false }],
          createdByUserId: "user-1",
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
  });
});

describe("POST /api/apihub/mapping-templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 400 when rules are empty", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/mapping-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-post-empty-rules",
        },
        body: JSON.stringify({ name: "X", rules: [] }),
      }),
    );
    expect(response.status).toBe(400);
    expect(createApiHubMappingTemplateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when rules exceed max count", async () => {
    const { POST } = await import("./route");
    const rules = Array.from({ length: APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT + 1 }, () => ({
      sourcePath: "x",
      targetField: "y",
    }));
    const response = await POST(
      new Request("http://localhost/api/apihub/mapping-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-post-too-many",
        },
        body: JSON.stringify({ name: "Big", rules }),
      }),
    );
    expect(response.status).toBe(400);
    expect(createApiHubMappingTemplateMock).not.toHaveBeenCalled();
  });

  it("creates template and returns 201", async () => {
    const createdAt = new Date("2026-04-22T10:00:00.000Z");
    const updatedAt = new Date("2026-04-22T10:00:00.000Z");
    createApiHubMappingTemplateMock.mockResolvedValue({
      id: "tpl-new",
      tenantId: "tenant-1",
      name: "My map",
      description: "d1",
      rules: [{ sourcePath: "s.id", targetField: "id", transform: "trim", required: true }],
      createdByUserId: "user-1",
      createdAt,
      updatedAt,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/apihub/mapping-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-post-ok",
        },
        body: JSON.stringify({
          name: "My map",
          description: "d1",
          rules: [{ sourcePath: "s.id", targetField: "id", transform: "trim", required: true }],
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(createApiHubMappingTemplateMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      createdByUserId: "user-1",
      name: "My map",
      description: "d1",
      rules: [{ sourcePath: "s.id", targetField: "id", transform: "trim", required: true }],
    });
    expect(await response.json()).toEqual({
      template: {
        id: "tpl-new",
        name: "My map",
        description: "d1",
        rules: [{ sourcePath: "s.id", targetField: "id", transform: "trim", required: true }],
        createdByUserId: "user-1",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
  });
});
