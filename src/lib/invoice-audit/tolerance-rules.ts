import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import { pickToleranceRuleFromOrderedActiveRules } from "@/lib/invoice-audit/tolerance-rule-pick";

export async function listToleranceRulesForTenant(params: { tenantId: string }) {
  return prisma.invoiceToleranceRule.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

/** Picks the highest-priority active rule for the intake currency, or null (caller uses code defaults). */
export async function pickToleranceRuleForIntake(params: { tenantId: string; currency: string }) {
  const rules = await prisma.invoiceToleranceRule.findMany({
    where: { tenantId: params.tenantId, active: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return pickToleranceRuleFromOrderedActiveRules(rules, params.currency);
}

export async function createToleranceRule(input: {
  tenantId: string;
  name: string;
  priority?: number;
  active?: boolean;
  amountAbsTolerance?: number | null;
  percentTolerance?: number | null;
  currencyScope?: string | null;
}) {
  return prisma.invoiceToleranceRule.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      priority: input.priority ?? 0,
      active: input.active ?? true,
      amountAbsTolerance:
        input.amountAbsTolerance != null
          ? new Prisma.Decimal(String(input.amountAbsTolerance))
          : null,
      percentTolerance:
        input.percentTolerance != null
          ? new Prisma.Decimal(String(input.percentTolerance))
          : null,
      currencyScope: input.currencyScope?.trim().toUpperCase().slice(0, 3) || null,
    },
  });
}

export async function getToleranceRuleForTenant(params: { tenantId: string; ruleId: string }) {
  const row = await prisma.invoiceToleranceRule.findFirst({
    where: { id: params.ruleId, tenantId: params.tenantId },
  });
  if (!row) throw new InvoiceAuditError("NOT_FOUND", "Tolerance rule not found.");
  return row;
}

export async function updateToleranceRuleForTenant(input: {
  tenantId: string;
  ruleId: string;
  name?: string;
  priority?: number;
  active?: boolean;
  amountAbsTolerance?: number | null;
  percentTolerance?: number | null;
  currencyScope?: string | null;
}) {
  await getToleranceRuleForTenant({ tenantId: input.tenantId, ruleId: input.ruleId });
  const data: Prisma.InvoiceToleranceRuleUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.active !== undefined) data.active = input.active;
  if (input.amountAbsTolerance !== undefined) {
    data.amountAbsTolerance =
      input.amountAbsTolerance != null ? new Prisma.Decimal(String(input.amountAbsTolerance)) : null;
  }
  if (input.percentTolerance !== undefined) {
    data.percentTolerance =
      input.percentTolerance != null ? new Prisma.Decimal(String(input.percentTolerance)) : null;
  }
  if (input.currencyScope !== undefined) {
    data.currencyScope = input.currencyScope?.trim().toUpperCase().slice(0, 3) || null;
  }
  if (Object.keys(data).length === 0) {
    throw new InvoiceAuditError("BAD_INPUT", "No fields to update on tolerance rule.");
  }
  return prisma.invoiceToleranceRule.update({
    where: { id: input.ruleId },
    data,
  });
}
