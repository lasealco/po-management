/**
 * Allowed `InvoiceChargeAlias.targetKind` values (Prisma string column).
 * Kept in a Prisma-free module so client components can import it without bundling `pg` / Node builtins.
 */
export const INVOICE_CHARGE_ALIAS_TARGET_KINDS = ["CONTRACT_RATE", "CONTRACT_CHARGE", "RFQ_LINE"] as const;

export const INVOICE_CHARGE_ALIAS_TARGET_KIND_SET = new Set<string>(
  INVOICE_CHARGE_ALIAS_TARGET_KINDS as unknown as string[],
);
