import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeAutoClearSrmOnboardingStage } from "./maybe-auto-clear-srm-onboarding-stage";

const findFirstSupply = vi.fn();
const findManyTask = vi.fn();
const updateSupplier = vi.fn();

const prisma = {
  supplier: {
    findFirst: findFirstSupply,
    update: updateSupplier,
  },
  supplierOnboardingTask: { findMany: findManyTask },
} as unknown as PrismaClient;

describe("maybeAutoClearSrmOnboardingStage (G-v1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns without update when already cleared", async () => {
    findFirstSupply.mockResolvedValueOnce({ srmOnboardingStage: "cleared" });
    const r = await maybeAutoClearSrmOnboardingStage(prisma, "t1", "s1");
    expect(r.didAutoAdvance).toBe(false);
    expect(r.srmOnboardingStage).toBe("cleared");
    expect(updateSupplier).not.toHaveBeenCalled();
  });

  it("returns without update when a task is not done", async () => {
    findFirstSupply.mockResolvedValueOnce({ srmOnboardingStage: "review" });
    findManyTask.mockResolvedValueOnce([{ done: true }, { done: false }]);
    const r = await maybeAutoClearSrmOnboardingStage(prisma, "t1", "s1");
    expect(r.didAutoAdvance).toBe(false);
    expect(updateSupplier).not.toHaveBeenCalled();
  });

  it("sets cleared when all tasks are done and stage was not cleared", async () => {
    findFirstSupply.mockResolvedValueOnce({ srmOnboardingStage: "diligence" });
    findManyTask.mockResolvedValueOnce([{ done: true }, { done: true }]);
    updateSupplier.mockResolvedValueOnce({ srmOnboardingStage: "cleared" });
    const r = await maybeAutoClearSrmOnboardingStage(prisma, "t1", "s1");
    expect(r.didAutoAdvance).toBe(true);
    expect(r.srmOnboardingStage).toBe("cleared");
    expect(updateSupplier).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { srmOnboardingStage: "cleared" },
      }),
    );
  });
});
