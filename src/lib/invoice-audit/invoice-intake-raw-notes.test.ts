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
import { setInvoiceIntakeRawSourceNotes } from "@/lib/invoice-audit/invoice-intakes";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setInvoiceIntakeRawSourceNotes", () => {
  it("persists trimmed notes", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({ id: "in1" } as never);
    vi.mocked(prisma.invoiceIntake.update).mockResolvedValue({} as never);

    await setInvoiceIntakeRawSourceNotes({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      rawSourceNotes: "  ticket ABC  ",
    });

    expect(prisma.invoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in1" },
      data: { rawSourceNotes: "ticket ABC" },
    });
  });

  it("clears notes when empty after trim", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({ id: "in1" } as never);
    vi.mocked(prisma.invoiceIntake.update).mockResolvedValue({} as never);

    await setInvoiceIntakeRawSourceNotes({
      tenantId: "t1",
      invoiceIntakeId: "in1",
      rawSourceNotes: "   ",
    });

    expect(prisma.invoiceIntake.update).toHaveBeenCalledWith({
      where: { id: "in1" },
      data: { rawSourceNotes: null },
    });
  });

  it("rejects notes over max length", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue({ id: "in1" } as never);
    await expect(
      setInvoiceIntakeRawSourceNotes({
        tenantId: "t1",
        invoiceIntakeId: "in1",
        rawSourceNotes: "x".repeat(12_001),
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prisma.invoiceIntake.update).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when intake missing", async () => {
    vi.mocked(prisma.invoiceIntake.findFirst).mockResolvedValue(null);
    await expect(
      setInvoiceIntakeRawSourceNotes({
        tenantId: "t1",
        invoiceIntakeId: "missing",
        rawSourceNotes: "a",
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof InvoiceAuditError && e.code === "NOT_FOUND");
  });
});
