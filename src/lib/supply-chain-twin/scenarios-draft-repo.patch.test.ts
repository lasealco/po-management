import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyChainTwinScenarioDraft: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

describe("patchScenarioDraftForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates title without a pre-read when status is omitted", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const detail = {
      id: "d1",
      title: "T",
      status: "draft",
      draftJson: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    findFirstMock.mockResolvedValueOnce(detail);

    const { patchScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const r = await patchScenarioDraftForTenant("tenant-1", "d1", { title: "T" });

    expect(r).toEqual({ ok: true, row: detail });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
  });

  it("allows draft → archived after reading current status", async () => {
    findFirstMock.mockResolvedValueOnce({ status: "draft" });
    updateManyMock.mockResolvedValue({ count: 1 });
    const after = {
      id: "d1",
      title: null,
      status: "archived",
      draftJson: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    };
    findFirstMock.mockResolvedValueOnce(after);

    const { patchScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const r = await patchScenarioDraftForTenant("tenant-1", "d1", { status: "archived" });

    expect(r).toEqual({ ok: true, row: after });
    expect(findFirstMock).toHaveBeenCalledTimes(2);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "d1", tenantId: "tenant-1" },
      data: { status: "archived" },
    });
  });

  it("returns not_found when row is missing before a status change", async () => {
    findFirstMock.mockResolvedValueOnce(null);

    const { patchScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const r = await patchScenarioDraftForTenant("tenant-1", "missing", { status: "archived" });

    expect(r).toEqual({ ok: false, reason: "not_found" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("rejects draft target when current status is neither draft nor archived", async () => {
    findFirstMock.mockResolvedValueOnce({ status: "published" });

    const { patchScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const r = await patchScenarioDraftForTenant("tenant-1", "d1", { status: "draft" });

    expect(r).toEqual({
      ok: false,
      reason: "invalid_status_transition",
      message: "Cannot set status to draft unless the scenario is archived or already draft.",
    });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("allows archived from an unknown legacy status", async () => {
    findFirstMock.mockResolvedValueOnce({ status: "published" });
    updateManyMock.mockResolvedValue({ count: 1 });
    const after = {
      id: "d1",
      title: null,
      status: "archived",
      draftJson: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    };
    findFirstMock.mockResolvedValueOnce(after);

    const { patchScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const r = await patchScenarioDraftForTenant("tenant-1", "d1", { status: "archived" });

    expect(r).toEqual({ ok: true, row: after });
    expect(updateManyMock).toHaveBeenCalled();
  });
});
