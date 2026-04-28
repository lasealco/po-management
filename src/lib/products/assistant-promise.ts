export const PRODUCT_PROMISE_STATUSES = ["PENDING", "REVIEWED", "RECOVERY_QUEUED", "PROMISE_READY"] as const;

export type ProductPromiseStatus = (typeof PRODUCT_PROMISE_STATUSES)[number];

export type ProductPromiseInputs = {
  onHandQty: number;
  allocatedQty: number;
  onHoldQty: number;
  openSalesDemandQty: number;
  inboundQty: number;
  openWmsTaskQty: number;
};

export function parseProductPromiseStatus(value: unknown): ProductPromiseStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return PRODUCT_PROMISE_STATUSES.includes(normalized as ProductPromiseStatus)
    ? (normalized as ProductPromiseStatus)
    : null;
}

export function computeProductAtp(input: ProductPromiseInputs) {
  const usableOnHand = Math.max(0, input.onHandQty - input.onHoldQty);
  const availableNow = Math.max(0, usableOnHand - input.allocatedQty);
  const shortageQty = Math.max(0, input.openSalesDemandQty - availableNow);
  const recoverableQty = Math.max(0, availableNow + input.inboundQty - input.openSalesDemandQty);
  const blockedQty = input.onHoldQty + input.openWmsTaskQty;
  const status =
    shortageQty <= 0
      ? "PROMISE_READY"
      : input.inboundQty >= shortageQty
        ? "RECOVERY_NEEDED"
        : "SHORTAGE";
  return { usableOnHand, availableNow, shortageQty, recoverableQty, blockedQty, status };
}

export function buildProductPromiseSummary(params: {
  productName: string;
  inputs: ProductPromiseInputs;
}) {
  const atp = computeProductAtp(params.inputs);
  return [
    `${params.productName}: available-to-promise is ${atp.availableNow}.`,
    `On hand ${params.inputs.onHandQty}, allocated ${params.inputs.allocatedQty}, on hold ${params.inputs.onHoldQty}.`,
    `Open sales demand ${params.inputs.openSalesDemandQty}; inbound PO quantity ${params.inputs.inboundQty}.`,
    atp.shortageQty > 0 ? `Shortage to recover: ${atp.shortageQty}.` : "No immediate ATP shortage from current signals.",
  ].join("\n");
}

export function buildProductRecoveryProposal(params: {
  productName: string;
  inputs: ProductPromiseInputs;
  hasHold: boolean;
  hasWmsBlocker: boolean;
}) {
  const atp = computeProductAtp(params.inputs);
  const steps = [
    `Review promise for ${params.productName}.`,
    params.hasHold ? "1. Inspect held inventory and release only after QC/compliance approval." : "1. No held inventory release is required from current balances.",
    params.hasWmsBlocker
      ? "2. Prioritize open WMS tasks blocking pick/putaway/replenishment for this SKU."
      : "2. No open WMS task blocker is visible for this SKU.",
    atp.shortageQty > 0
      ? `3. Use inbound supply or reallocation proposal to recover ${atp.shortageQty} units before confirming customer promise.`
      : "3. Confirm promise with current available stock and keep inbound as buffer.",
    "4. Queue any stock move or reservation through a human-approved action. Do not mutate inventory silently.",
  ];
  return steps.join("\n");
}
