import { beforeEach, describe, expect, it, vi } from "vitest";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getApiHubMappingTemplateByIdMock = vi.fn();

vi.mock("@/lib/demo-tenant", () => ({ getDemoTenant: getDemoTenantMock }));
vi.mock("@/lib/authz", () => ({ getActorUserId: getActorUserIdMock }));
vi.mock("@/lib/apihub/mapping-templates-repo", () => ({
  getApiHubMappingTemplateById: getApiHubMappingTemplateByIdMock,
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
