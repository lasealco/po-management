import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

export async function listToleranceRulesForTenant(params: { tenantId: string }) {
  return prisma.invoiceToleranceRule.findMany({
    where: { tenantId: params.tenantId },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

/** Picks the highest-priority active rule for the intake currency, or null (caller uses code defaults). */
export async function pickToleranceRuleForIntake(params: { tenantId: string; currency: string }) {
  const cur = params.currency.toUpperCase().slice(0, 3);
  const rules = await prisma.invoiceToleranceRule.findMany({
    where: { tenantId: params.tenantId, active: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  const scoped = rules.find((r) => r.currencyScope && r.currencyScope.toUpperCase() === cur);
  if (scoped) return scoped;
  const global = rules.find((r) => !r.currencyScope);
  return global ?? rules[0] ?? null;
}

export async function createToleranceRule(input: {
  tenantId: string;
  name: string;
  priority?: number;
  amountAbsTolerance?: number | null;
  percentTolerance?: number | null;
  currencyScope?: string | null;
}) {
  return prisma.invoiceToleranceRule.create({
    data: {
      tenantId: input.tenantId,
      name: input.name.trim(),
      priority: input.priority ?? 0,
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
