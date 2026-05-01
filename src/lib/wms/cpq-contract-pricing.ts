import { Prisma } from "@prisma/client";

export type QuoteLineCommercialInputs = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  listUnitPrice: Prisma.Decimal | null;
  priceTierLabel: string | null | undefined;
};

export type ResolvedCommercialPricing = {
  contractUnitPrice: string;
  listUnitPrice: string | null;
  unitDelta: string | null;
  extendedContract: string;
  extendedList: string | null;
  tierLabel: string | null;
};

/**
 * BF-22 — derive display snapshots from CRM quote line commercial fields.
 * Quote subtotal remains qty × contracted `unitPrice`; optional `listUnitPrice` drives list-vs-contract deltas.
 */
export function resolveQuoteLineCommercialPricing(
  input: QuoteLineCommercialInputs,
): ResolvedCommercialPricing {
  const qty = new Prisma.Decimal(input.quantity);
  const contract = new Prisma.Decimal(input.unitPrice);
  const tierRaw = input.priceTierLabel?.trim();
  const tierLabel = tierRaw ? tierRaw.slice(0, 64) : null;

  const extendedContract = qty.mul(contract).toDecimalPlaces(2).toFixed(2);

  const rawList =
    input.listUnitPrice != null ? new Prisma.Decimal(input.listUnitPrice) : null;
  const hasList = rawList != null && rawList.gt(0);

  if (!hasList || rawList == null) {
    return {
      contractUnitPrice: contract.toString(),
      listUnitPrice: null,
      unitDelta: null,
      extendedContract,
      extendedList: null,
      tierLabel,
    };
  }

  const list = rawList;
  const extendedList = qty.mul(list).toDecimalPlaces(2).toFixed(2);
  const unitDelta = list.minus(contract).toDecimalPlaces(4).toFixed(4);

  return {
    contractUnitPrice: contract.toString(),
    listUnitPrice: list.toString(),
    unitDelta,
    extendedContract,
    extendedList,
    tierLabel,
  };
}
