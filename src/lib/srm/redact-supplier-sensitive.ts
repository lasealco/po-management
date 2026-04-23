import type { SupplierDetailSnapshot } from "@/components/supplier-detail-client";

type SupplierSensitiveFields = {
  internalNotes: string | null;
  taxId: string | null;
  creditLimit: unknown;
  creditCurrency: string | null;
  contacts: Array<Record<string, unknown> & { notes: string | null }>;
};

/**
 * Phase K: procurement-sensitive fields (policy: org.suppliers → edit or approve).
 * Use for API responses and server-rendered 360 so view-only users never receive values.
 */
export function redactSupplierDetailSnapshot(
  snapshot: SupplierDetailSnapshot,
  canViewSensitive: boolean,
): SupplierDetailSnapshot {
  if (canViewSensitive) return snapshot;
  return {
    ...snapshot,
    internalNotes: null,
    taxId: null,
    creditLimit: null,
    creditCurrency: null,
    contacts: snapshot.contacts.map((c) => ({ ...c, notes: null })),
  };
}

export function redactSupplierGetPayload<T extends SupplierSensitiveFields>(
  supplier: T,
  canViewSensitive: boolean,
): T {
  if (canViewSensitive) return supplier;
  return {
    ...supplier,
    internalNotes: null,
    taxId: null,
    creditLimit: null,
    creditCurrency: null,
    contacts: supplier.contacts.map((c) => ({ ...c, notes: null })),
  } as T;
}
