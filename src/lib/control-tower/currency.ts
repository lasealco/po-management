import { Prisma } from "@prisma/client";

export type FxRateRow = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: Prisma.Decimal;
  rateDate: Date;
};

export function normalizeCurrency(input: string | null | undefined, fallback = "USD"): string {
  const raw = (input ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  return fallback;
}

export function minorToAmount(amountMinor: bigint): number {
  return Number(amountMinor) / 100;
}

export function amountToMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

export function convertAmount(params: {
  amount: number;
  sourceCurrency: string;
  targetCurrency: string;
  rates: FxRateRow[];
}): { converted: number | null; fxDate: string | null } {
  const source = normalizeCurrency(params.sourceCurrency);
  const target = normalizeCurrency(params.targetCurrency);
  if (source === target) {
    return { converted: params.amount, fxDate: null };
  }

  const direct = params.rates.find((r) => r.baseCurrency === source && r.quoteCurrency === target);
  if (direct) {
    return {
      converted: params.amount * Number(direct.rate),
      fxDate: direct.rateDate.toISOString(),
    };
  }

  const inverse = params.rates.find((r) => r.baseCurrency === target && r.quoteCurrency === source);
  if (inverse) {
    const rate = Number(inverse.rate);
    if (rate > 0) {
      return {
        converted: params.amount / rate,
        fxDate: inverse.rateDate.toISOString(),
      };
    }
  }

  return { converted: null, fxDate: null };
}
