import type { InventoryMovementType } from "@prisma/client";

/** Starter rates for demo tenants; replace with CRM-backed profiles in Phase C. */
export type DefaultRateSeed = {
  code: string;
  description: string;
  movementType: InventoryMovementType | null;
  amountPerUnit: string;
};

export const DEFAULT_WMS_BILLING_RATES: DefaultRateSeed[] = [
  {
    code: "RATE_RECEIPT",
    description: "Receipt / inbound handling per quantity unit",
    movementType: "RECEIPT",
    amountPerUnit: "0.35",
  },
  {
    code: "RATE_PUTAWAY",
    description: "Putaway move per quantity unit",
    movementType: "PUTAWAY",
    amountPerUnit: "0.55",
  },
  {
    code: "RATE_PICK",
    description: "Pick move per quantity unit",
    movementType: "PICK",
    amountPerUnit: "0.65",
  },
  {
    code: "RATE_ADJUSTMENT",
    description: "Inventory adjustment per quantity unit",
    movementType: "ADJUSTMENT",
    amountPerUnit: "0.10",
  },
  {
    code: "RATE_SHIPMENT",
    description: "Outbound shipment posting per quantity unit",
    movementType: "SHIPMENT",
    amountPerUnit: "0.85",
  },
  {
    code: "RATE_FALLBACK",
    description: "Fallback when no movement-type rate matches",
    movementType: null,
    amountPerUnit: "0.20",
  },
];
