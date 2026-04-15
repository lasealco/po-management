import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeCurrency } from "@/lib/control-tower/currency";

type FrankfurterResponse = {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

function parseListEnv(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? "")
    .split(",")
    .map((v) => normalizeCurrency(v, ""))
    .filter(Boolean);
  return items.length ? Array.from(new Set(items)) : fallback;
}

export async function refreshControlTowerFxRatesAllTenants() {
  const provider = "frankfurter";
  const baseCurrencies = parseListEnv(process.env.CONTROL_TOWER_FX_BASES, ["USD", "EUR"]);
  const fallbackTargets = parseListEnv(process.env.CONTROL_TOWER_FX_TARGETS, ["USD", "EUR", "GBP", "CNY"]);
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let upserts = 0;
  let pairs = 0;

  for (const tenant of tenants) {
    const lineCurrenciesRaw = await prisma.ctShipmentCostLine.findMany({
      where: { tenantId: tenant.id },
      select: { currency: true },
      distinct: ["currency"],
    });
    const prefRows = await prisma.userPreference.findMany({
      where: { tenantId: tenant.id, key: "controlTower.displayCurrency" },
      select: { value: true },
    });
    const prefCurrencies = prefRows
      .map((p) => (p.value && typeof p.value === "object" && "currency" in p.value ? (p.value as { currency?: unknown }).currency : null))
      .filter((v): v is string => typeof v === "string")
      .map((v) => normalizeCurrency(v));
    const tenantCurrencies = Array.from(
      new Set([
        ...fallbackTargets,
        ...lineCurrenciesRaw.map((r) => normalizeCurrency(r.currency)),
        ...prefCurrencies,
      ]),
    ).filter(Boolean);

    for (const base of baseCurrencies) {
      const targets = tenantCurrencies.filter((t) => t !== base);
      if (!targets.length) continue;
      const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(targets.join(","))}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as FrankfurterResponse;
      if (!data.rates || !data.date) continue;
      const rateDate = new Date(`${data.date}T00:00:00.000Z`);
      if (Number.isNaN(rateDate.getTime())) continue;

      for (const [quote, rate] of Object.entries(data.rates)) {
        const quoteCurrency = normalizeCurrency(quote, "");
        if (!quoteCurrency || !Number.isFinite(rate) || rate <= 0) continue;
        pairs += 1;
        await prisma.ctFxRate.upsert({
          where: {
            tenantId_baseCurrency_quoteCurrency_rateDate: {
              tenantId: tenant.id,
              baseCurrency: base,
              quoteCurrency,
              rateDate,
            },
          },
          create: {
            tenantId: tenant.id,
            baseCurrency: base,
            quoteCurrency,
            rate: new Prisma.Decimal(rate),
            rateDate,
            provider,
          },
          update: {
            rate: new Prisma.Decimal(rate),
            provider,
          },
        });
        upserts += 1;
      }
    }
  }

  return { tenants: tenants.length, pairsSeen: pairs, upserts };
}
