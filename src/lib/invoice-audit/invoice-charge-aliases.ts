import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import {
  INVOICE_CHARGE_ALIAS_TARGET_KINDS,
  INVOICE_CHARGE_ALIAS_TARGET_KIND_SET,
} from "@/lib/invoice-audit/invoice-charge-alias-constants";

export { INVOICE_CHARGE_ALIAS_TARGET_KINDS } from "@/lib/invoice-audit/invoice-charge-alias-constants";

/**
 * Parse API body `canonicalTokens`: JSON array of strings, or a single string split on newlines / commas / semicolons.
 * Returns `null` when the field is omitted (`undefined`).
 */
export function parseCanonicalTokensFromBody(v: unknown): string[] | null {
  if (v === undefined) return null;
  if (Array.isArray(v)) {
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out;
  }
  if (typeof v === "string") {
    return v.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return null;
}

export function coerceChargeAliasTargetKind(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim().toUpperCase();
  if (!INVOICE_CHARGE_ALIAS_TARGET_KIND_SET.has(t)) {
    throw new InvoiceAuditError(
      "BAD_INPUT",
      `Invalid targetKind. Use one of: ${INVOICE_CHARGE_ALIAS_TARGET_KINDS.join(", ")}, or omit for any kind.`,
    );
  }
  return t;
}

export async function listInvoiceChargeAliasesForTenant(params: { tenantId: string }) {
  return prisma.invoiceChargeAlias.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
}

export async function getInvoiceChargeAliasForTenant(params: { tenantId: string; aliasId: string }) {
  const row = await prisma.invoiceChargeAlias.findFirst({
    where: { id: params.aliasId, tenantId: params.tenantId },
  });
  if (!row) throw new InvoiceAuditError("NOT_FOUND", "Charge alias not found.");
  return row;
}

export async function createInvoiceChargeAlias(input: {
  tenantId: string;
  pattern: string;
  canonicalTokens: string[];
  name?: string | null;
  targetKind?: string | null;
  priority?: number;
  active?: boolean;
}) {
  const pattern = input.pattern.trim();
  if (!pattern) throw new InvoiceAuditError("BAD_INPUT", "pattern is required.");
  const tokens = input.canonicalTokens.map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) throw new InvoiceAuditError("BAD_INPUT", "At least one canonical token is required.");

  let targetKind: string | null = null;
  if (input.targetKind != null && String(input.targetKind).trim() !== "") {
    targetKind = coerceChargeAliasTargetKind(input.targetKind);
  }

  return prisma.invoiceChargeAlias.create({
    data: {
      tenantId: input.tenantId,
      name: input.name?.trim() || null,
      pattern,
      canonicalTokens: tokens,
      targetKind,
      priority: input.priority ?? 0,
      active: input.active ?? true,
    },
  });
}

export async function updateInvoiceChargeAliasForTenant(input: {
  tenantId: string;
  aliasId: string;
  name?: string | null;
  pattern?: string;
  canonicalTokens?: string[];
  targetKind?: string | null;
  priority?: number;
  active?: boolean;
}) {
  await getInvoiceChargeAliasForTenant({ tenantId: input.tenantId, aliasId: input.aliasId });

  const data: Prisma.InvoiceChargeAliasUpdateInput = {};
  if (input.name !== undefined) data.name = input.name?.trim() || null;
  if (input.pattern !== undefined) {
    const p = input.pattern.trim();
    if (!p) throw new InvoiceAuditError("BAD_INPUT", "pattern cannot be empty.");
    data.pattern = p;
  }
  if (input.canonicalTokens !== undefined) {
    const tokens = input.canonicalTokens.map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) throw new InvoiceAuditError("BAD_INPUT", "At least one canonical token is required.");
    data.canonicalTokens = tokens;
  }
  if (input.targetKind !== undefined) {
    if (input.targetKind == null || String(input.targetKind).trim() === "") {
      data.targetKind = null;
    } else {
      data.targetKind = coerceChargeAliasTargetKind(input.targetKind);
    }
  }
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.active !== undefined) data.active = input.active;

  if (Object.keys(data).length === 0) {
    throw new InvoiceAuditError("BAD_INPUT", "No fields to update on charge alias.");
  }

  return prisma.invoiceChargeAlias.update({
    where: { id: input.aliasId },
    data,
  });
}
