/** One declared service / transport line for SRM (see `SupplierServiceCapability`). */
export type SupplierCapabilityRow = {
  id: string;
  mode: string | null;
  subMode: string | null;
  serviceType: string;
  geography: string | null;
  notes: string | null;
};
