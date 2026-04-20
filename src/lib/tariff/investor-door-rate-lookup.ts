import { prisma } from "@/lib/prisma";

/** Seeded by `npm run db:seed:tariff-deham-uschi-investor-demo` — two comparable ocean FCL stacks. */
export const INVESTOR_DD_CONTRACT_NUMBERS = ["DEMO-INV-DD-OPTION-A", "DEMO-INV-DD-OPTION-B"] as const;

export type InvestorDoorRateLineBreakdown = {
  kind: "RATE" | "CHARGE";
  label: string;
  rateType?: string | null;
  rawChargeName?: string | null;
  normalizedCode?: string | null;
  unitBasis: string;
  currency: string;
  amount: number;
};

export type InvestorDoorRateOption = {
  contractNumber: string;
  title: string;
  carrierLegalName: string;
  carrierTradingName: string | null;
  lines: InvestorDoorRateLineBreakdown[];
  totalUsd: number;
};

function num(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Loads the two investor-demo contracts and returns a side-by-side–ready breakdown
 * (pre-carriage, forwarder-style charges, ocean base + surcharges, on-carriage).
 */
export async function lookupInvestorDehamUschiDoorRates(params: {
  tenantId: string;
}): Promise<{ lane: string; equipment: string; options: InvestorDoorRateOption[] }> {
  const headers = await prisma.tariffContractHeader.findMany({
    where: {
      tenantId: params.tenantId,
      contractNumber: { in: [...INVESTOR_DD_CONTRACT_NUMBERS] },
    },
    include: {
      provider: { select: { legalName: true, tradingName: true } },
      versions: {
        where: { status: "APPROVED", approvalStatus: "APPROVED" },
        orderBy: { versionNo: "desc" },
        take: 1,
        include: {
          rateLines: {
            include: { originScope: true, destinationScope: true },
            orderBy: { id: "asc" },
          },
          chargeLines: {
            include: { normalizedChargeCode: { select: { code: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  const byNo = new Map(headers.map((h) => [h.contractNumber ?? "", h]));
  const ordered: typeof headers = [];
  for (const no of INVESTOR_DD_CONTRACT_NUMBERS) {
    const h = byNo.get(no);
    if (h) ordered.push(h);
  }

  const options: InvestorDoorRateOption[] = [];
  for (const h of ordered) {
    const v = h.versions[0];
    if (!v) continue;

    const lines: InvestorDoorRateLineBreakdown[] = [];
    for (const r of v.rateLines) {
      const o = r.originScope?.name ?? r.originScope?.code ?? "—";
      const d = r.destinationScope?.name ?? r.destinationScope?.code ?? "—";
      lines.push({
        kind: "RATE",
        label: `${r.rateType.replaceAll("_", " ")} · ${o} → ${d}`,
        rateType: r.rateType,
        unitBasis: r.unitBasis,
        currency: r.currency,
        amount: num(r.amount),
      });
    }
    for (const c of v.chargeLines) {
      lines.push({
        kind: "CHARGE",
        label: c.rawChargeName,
        rawChargeName: c.rawChargeName,
        normalizedCode: c.normalizedChargeCode?.code ?? null,
        unitBasis: c.unitBasis,
        currency: c.currency,
        amount: num(c.amount),
      });
    }

    const totalUsd = lines.filter((l) => l.currency === "USD").reduce((s, l) => s + l.amount, 0);

    options.push({
      contractNumber: h.contractNumber ?? "",
      title: h.title,
      carrierLegalName: h.provider.legalName,
      carrierTradingName: h.provider.tradingName,
      lines,
      totalUsd,
    });
  }

  return {
    lane: "DEHAM → USCHI (door-to-door, FCL)",
    equipment: "40' HC",
    options,
  };
}
