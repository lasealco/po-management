import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoiceIntake: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { setInvoiceIntakeReview } from "@/lib/invoice-audit/invoice-intakes";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setInvoiceIntakeReview", () => {
  it("rejects review when intake is not AUDITED", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({ id: "in1", status: "PARSED" } as never);
    await expect(
      setInvoiceIntakeReview({
        tenantId: "t1",
        invoiceIntakeId: "in1",
        reviewDecision: "APPROVED",
        reviewedByUserId: "user1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.invoiceIntake.update).not.toHaveBeenCalled();
  });

  it("persists APPROVED with reviewer metadata", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({ id: "in1", status: "AUDITED" } as never);
    vi.mocked(prisma.invoiceIntake.update).mockResolvedValue({
      id: "in1",
      reviewDecision: "APPROVED",
      reviewNote: "OK",
      reviewedAt: new Date(),
    } as never);

    const out = await setInvoiceIntakeReview({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      reviewDecision: "APPROVED",
      reviewNote: "OK",
      reviewedByUserId: "user1",
    });

    expect(out.reviewDecision).toBe("APPROVED");
    expect(prisma.invoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in1" },
      data: expect.objectContaining({
        reviewDecision: "APPROVED",
        reviewNote: "OK",
        reviewedByUserId: "user1",
      }),
      include: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when intake is missing", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue(null);
    await expect(
      setInvoiceIntakeReview({
        tenantId: "t1",
        invoiceIntakeId: "missing",
        reviewDecision: "OVERRIDDEN",
        reviewedByUserId: "user1",
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof InvoiceAuditError && e.code === "NOT_FOUND");
  });
});
