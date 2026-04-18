import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, invoiceIntake } = vi.hoisted(() => {
  const inner = {
    findFirst: vi.fn(),
    update: vi.fn(),
    findFirstOrThrow: vi.fn(),
  };
  const mock = {
    invoiceIntake: inner,
    $transaction: vi.fn(async (fn: (tx: { invoiceIntake: typeof inner }) => Promise<unknown>) =>
      fn({ invoiceIntake: inner }),
    ),
  };
  return { prismaMock: mock, invoiceIntake: inner };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { patchInvoiceIntakeReviewAndAccounting } from "@/lib/invoice-audit/invoice-intakes";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("patchInvoiceIntakeReviewAndAccounting", () => {
  it("runs review update then accounting update in one transaction", async () => {
    vi.mocked(invoiceIntake.findFirst).mockResolvedValue({ id: "in1", status: "AUDITED" } as never);
    vi.mocked(invoiceIntake.update).mockResolvedValue({} as never);
    vi.mocked(invoiceIntake.findFirstOrThrow).mockResolvedValue({ id: "in1", reviewDecision: "APPROVED" } as never);

    const out = await patchInvoiceIntakeReviewAndAccounting({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      actorUserId: "u1",
      reviewDecision: "APPROVED",
      reviewNote: "ok",
      approvedForAccounting: true,
      accountingApprovalNote: "GL 1",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(invoiceIntake.update).toHaveBeenCalledTimes(2);
    expect(out.id).toBe("in1");
    const firstUpdate = vi.mocked(invoiceIntake.update).mock.calls[0]?.[0];
    const secondUpdate = vi.mocked(invoiceIntake.update).mock.calls[1]?.[0];
    expect(firstUpdate?.data).toMatchObject({ reviewDecision: "APPROVED", approvedForAccounting: false });
    expect(secondUpdate?.data).toMatchObject({ approvedForAccounting: true, accountingApprovalNote: "GL 1" });
  });

  it("throws NOT_FOUND when intake is missing", async () => {
    vi.mocked(invoiceIntake.findFirst).mockResolvedValue(null);
    await expect(
      patchInvoiceIntakeReviewAndAccounting({
        tenantId: "t1",
        invoiceIntakeId: "missing",
        actorUserId: "u1",
        reviewDecision: "APPROVED",
        reviewNote: null,
        approvedForAccounting: false,
        accountingApprovalNote: null,
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof InvoiceAuditError && e.code === "NOT_FOUND");
    expect(invoiceIntake.update).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when status is not AUDITED", async () => {
    vi.mocked(invoiceIntake.findFirst).mockResolvedValue({ id: "in1", status: "PARSED" } as never);
    await expect(
      patchInvoiceIntakeReviewAndAccounting({
        tenantId: "t1",
        invoiceIntakeId: "in1",
        actorUserId: "u1",
        reviewDecision: "OVERRIDDEN",
        reviewNote: null,
        approvedForAccounting: true,
        accountingApprovalNote: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(invoiceIntake.update).not.toHaveBeenCalled();
  });
});
