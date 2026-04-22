import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findFirstOrThrow = vi.fn();
const findFirst = vi.fn();
const deleteMany = vi.fn();
const auditCreate = vi.fn();

function makeTx() {
  return {
    apiHubMappingTemplate: {
      updateMany,
      findFirstOrThrow,
      findFirst,
      deleteMany,
    },
    apiHubMappingTemplateAuditLog: {
      create: auditCreate,
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => fn(makeTx())),
  },
}));

describe("mapping-templates-repo tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes updateMany to tenantId + template id", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findFirstOrThrow.mockResolvedValue({
      id: "tpl-1",
      tenantId: "tenant-a",
      name: "N",
      description: null,
      rules: [],
      createdByUserId: "u1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { updateApiHubMappingTemplate } = await import("./mapping-templates-repo");
    await updateApiHubMappingTemplate({
      tenantId: "tenant-a",
      templateId: "tpl-1",
      actorUserId: "u1",
      data: { name: "Renamed" },
      auditNote: null,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "tpl-1", tenantId: "tenant-a" },
      data: { name: "Renamed" },
    });
  });

  it("scopes deleteMany to tenantId + template id", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const { deleteApiHubMappingTemplate } = await import("./mapping-templates-repo");
    await deleteApiHubMappingTemplate({
      tenantId: "tenant-b",
      templateId: "tpl-2",
      actorUserId: "u2",
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "tpl-2", tenantId: "tenant-b" },
    });
  });
});
