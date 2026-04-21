import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubMappingTemplateByIdMock = vi.fn();
const updateApiHubMappingTemplateMock = vi.fn();
const deleteApiHubMappingTemplateMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/mapping-templates-repo", () => ({
  getApiHubMappingTemplateById: getApiHubMappingTemplateByIdMock,
  updateApiHubMappingTemplate: updateApiHubMappingTemplateMock,
  deleteApiHubMappingTemplate: deleteApiHubMappingTemplateMock,
}));

describe("GET /api/apihub/mapping-templates/:templateId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when template missing", async () => {
    getApiHubMappingTemplateByIdMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-missing", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-get-miss" },
      }),
      { params: Promise.resolve({ templateId: "tpl-missing" }) },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get(APIHUB_REQUEST_ID_HEADER)).toBe("mtpl-get-miss");
  });

  it("returns template dto", async () => {
    const createdAt = new Date("2026-04-22T11:00:00.000Z");
    const updatedAt = new Date("2026-04-22T11:00:00.000Z");
    getApiHubMappingTemplateByIdMock.mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-1",
      name: "N",
      description: null,
      rules: [{ sourcePath: "a", targetField: "b" }],
      createdByUserId: "user-1",
      createdAt,
      updatedAt,
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1", {
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-get-ok" },
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(200);
    expect(getApiHubMappingTemplateByIdMock).toHaveBeenCalledWith({ tenantId: "tenant-1", templateId: "tpl-1" });
    expect(await response.json()).toEqual({
      template: {
        id: "tpl-1",
        name: "N",
        description: null,
        rules: [{ sourcePath: "a", targetField: "b", required: false }],
        createdByUserId: "user-1",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
  });
});

describe("PATCH /api/apihub/mapping-templates/:templateId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 400 when no updatable fields are sent", async () => {
    getApiHubMappingTemplateByIdMock.mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-1",
      name: "N",
      description: null,
      rules: [{ sourcePath: "a", targetField: "b" }],
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-patch-empty",
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(400);
    expect(updateApiHubMappingTemplateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when template missing", async () => {
    getApiHubMappingTemplateByIdMock.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-x", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-patch-miss",
        },
        body: JSON.stringify({ name: "Z" }),
      }),
      { params: Promise.resolve({ templateId: "tpl-x" }) },
    );
    expect(response.status).toBe(404);
    expect(updateApiHubMappingTemplateMock).not.toHaveBeenCalled();
  });

  it("updates name and returns template", async () => {
    const createdAt = new Date("2026-04-22T10:00:00.000Z");
    const updatedAt = new Date("2026-04-22T12:00:00.000Z");
    getApiHubMappingTemplateByIdMock.mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-1",
      name: "Old",
      description: null,
      rules: [{ sourcePath: "a", targetField: "b" }],
      createdByUserId: "user-1",
      createdAt,
      updatedAt,
    });
    updateApiHubMappingTemplateMock.mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-1",
      name: "New",
      description: null,
      rules: [{ sourcePath: "a", targetField: "b" }],
      createdByUserId: "user-1",
      createdAt,
      updatedAt,
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [APIHUB_REQUEST_ID_HEADER]: "mtpl-patch-name",
        },
        body: JSON.stringify({ name: "New", note: "renamed" }),
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(200);
    expect(updateApiHubMappingTemplateMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      templateId: "tpl-1",
      actorUserId: "user-1",
      data: { name: "New" },
      auditNote: "renamed",
    });
    expect(await response.json()).toEqual({
      template: {
        id: "tpl-1",
        name: "New",
        description: null,
        rules: [{ sourcePath: "a", targetField: "b", required: false }],
        createdByUserId: "user-1",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
  });
});

describe("DELETE /api/apihub/mapping-templates/:templateId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
  });

  it("returns 404 when template missing", async () => {
    deleteApiHubMappingTemplateMock.mockResolvedValue(false);
    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-x", {
        method: "DELETE",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-del-miss" },
      }),
      { params: Promise.resolve({ templateId: "tpl-x" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns deleted payload", async () => {
    deleteApiHubMappingTemplateMock.mockResolvedValue(true);
    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/apihub/mapping-templates/tpl-1", {
        method: "DELETE",
        headers: { [APIHUB_REQUEST_ID_HEADER]: "mtpl-del-ok" },
      }),
      { params: Promise.resolve({ templateId: "tpl-1" }) },
    );
    expect(response.status).toBe(200);
    expect(deleteApiHubMappingTemplateMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      templateId: "tpl-1",
      actorUserId: "user-1",
    });
    expect(await response.json()).toEqual({ deleted: true, templateId: "tpl-1" });
  });
});
