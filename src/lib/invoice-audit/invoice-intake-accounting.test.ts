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
import { setInvoiceIntakeAccountingHandoff } from "@/lib/invoice-audit/invoice-intakes";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setInvoiceIntakeAccountingHandoff", () => {
  it("rejects when intake is not AUDITED", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({
      id: "in1",
      status: "PARSED",
      reviewDecision: "APPROVED",
    } as never);
    await expect(
      setInvoiceIntakeAccountingHandoff({
        tenantId: "t1",
        invoiceIntakeId: "in1",
        approvedForAccounting: true,
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.invoiceIntake.update).not.toHaveBeenCalled();
  });

  it("rejects when finance review is still NONE", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({
      id: "in1",
      status: "AUDITED",
      reviewDecision: "NONE",
    } as never);
    await expect(
      setInvoiceIntakeAccountingHandoff({
        tenantId: "t1",
        invoiceIntakeId: "in1",
        approvedForAccounting: true,
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.invoiceIntake.update).not.toHaveBeenCalled();
  });

  it("persists approved handoff with actor and optional note", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({
      id: "in1",
      status: "AUDITED",
      reviewDecision: "APPROVED",
    } as never);
    vi.mocked(prisma.invoiceIntake.update).mockResolvedValue({ id: "in1", approvedForAccounting: true } as never);

    await setInvoiceIntakeAccountingHandoff({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      approvedForAccounting: true,
      accountingApprovalNote: "GL 4400",
      actorUserId: "u1",
    });

    expect(prisma.invoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in1" },
      data: expect.objectContaining({
        approvedForAccounting: true,
        accountingApprovedByUserId: "u1",
        accountingApprovalNote: "GL 4400",
        accountingApprovedAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });

  it("clears handoff when approvedForAccounting is false", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({
      id: "in1",
      status: "AUDITED",
      reviewDecision: "OVERRIDDEN",
    } as never);
    vi.mocked(prisma.invoiceIntake.update).mockResolvedValue({ id: "in1" } as never);

    await setInvoiceIntakeAccountingHandoff({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      approvedForAccounting: false,
      actorUserId: "u1",
    });

    expect(prisma.invoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in1" },
      data: {
        approvedForAccounting: false,
        accountingApprovedAt: null,
        accountingApprovedByUserId: null,
        accountingApprovalNote: null,
      },
      include: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when intake is missing", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue(null);
    await expect(
      setInvoiceIntakeAccountingHandoff({
        tenantId: "t1",
        invoiceIntakeId: "missing",
        approvedForAccounting: true,
        actorUserId: "u1",
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof InvoiceAuditError && e.code === "NOT_FOUND");
  });
});
