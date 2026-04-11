import { Prisma, type PrismaClient } from "@prisma/client";

type Tx = Pick<PrismaClient, "crmQuoteLine" | "crmQuote">;

export async function recalcQuoteSubtotal(tx: Tx, quoteId: string): Promise<void> {
  const lines = await tx.crmQuoteLine.findMany({
    where: { quoteId },
    select: { quantity: true, unitPrice: true, extendedAmount: true },
  });
  if (lines.length === 0) {
    await tx.crmQuote.update({
      where: { id: quoteId },
      data: { subtotal: null },
    });
    return;
  }
  let sum = 0;
  for (const l of lines) {
    const q = Number(l.quantity);
    const p = Number(l.unitPrice);
    const ext = l.extendedAmount != null ? Number(l.extendedAmount) : q * p;
    sum += ext;
  }
  await tx.crmQuote.update({
    where: { id: quoteId },
    data: { subtotal: new Prisma.Decimal(sum.toFixed(2)) },
  });
}
