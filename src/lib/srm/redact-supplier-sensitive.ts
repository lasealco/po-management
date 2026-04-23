import type { SupplierDetailSnapshot } from "@/components/supplier-detail-client";

/**
 * K-v1: Fields gated by `org.suppliers` → **edit** or **approve** (view-only does not see values).
 * Documented set — extend here and in `docs/srm/SRM_ROADMAP_G_I_K.md` when adding columns:
 * - Company: `legalName`, `email`, `phone`, `taxId`, registered address line/city/region/postal/country
 * - Commercial: `paymentTermsDays`, `paymentTermsLabel`, `creditLimit`, `creditCurrency`, `defaultIncoterm`, `bookingConfirmationSlaHours`, `internalNotes`
 * - Contacts: `email`, `phone`, `notes` (name/title/role/primary still visible for coordination)
 * - Offices (API payload): all address / location fields; snapshot exposes `city` + `countryCode` only
 * - Capabilities: `geography`, `notes` (service line still visible)
 */
type ContactSensitive = {
  notes: string | null;
  email: string | null;
  phone: string | null;
};

type SupplierSensitiveFields = {
  legalName: string | null;
  email: string | null;
  phone: string | null;
  internalNotes: string | null;
  taxId: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredPostalCode: string | null;
  registeredCountryCode: string | null;
  paymentTermsDays: number | null;
  paymentTermsLabel: string | null;
  creditLimit: unknown;
  creditCurrency: string | null;
  defaultIncoterm: string | null;
  bookingConfirmationSlaHours: number | null;
  contacts: Array<Record<string, unknown> & ContactSensitive>;
  offices: Array<Record<string, unknown>>;
};

function redactContactRow<C extends ContactSensitive & Record<string, unknown>>(c: C): C {
  return { ...c, notes: null, email: null, phone: null } as C;
}

function redactOfficeForApi<T extends Record<string, unknown>>(o: T): T {
  return {
    ...o,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
  } as T;
}

export function redactSupplierDetailSnapshot(
  snapshot: SupplierDetailSnapshot,
  canViewSensitive: boolean,
): SupplierDetailSnapshot {
  if (canViewSensitive) return snapshot;
  return {
    ...snapshot,
    legalName: null,
    email: null,
    phone: null,
    internalNotes: null,
    taxId: null,
    registeredAddressLine1: null,
    registeredAddressLine2: null,
    registeredCity: null,
    registeredRegion: null,
    registeredPostalCode: null,
    registeredCountryCode: null,
    paymentTermsDays: null,
    paymentTermsLabel: null,
    creditLimit: null,
    creditCurrency: null,
    defaultIncoterm: null,
    bookingConfirmationSlaHours: null,
    contacts: snapshot.contacts.map((c) => redactContactRow(c)),
    offices: snapshot.offices.map((o) => ({ ...o, city: null, countryCode: null })),
    capabilities: snapshot.capabilities.map((cap) => ({
      ...cap,
      geography: null,
      notes: null,
    })),
  };
}

export function redactSupplierGetPayload<T extends SupplierSensitiveFields>(supplier: T, canViewSensitive: boolean): T {
  if (canViewSensitive) return supplier;
  return {
    ...supplier,
    legalName: null,
    email: null,
    phone: null,
    internalNotes: null,
    taxId: null,
    registeredAddressLine1: null,
    registeredAddressLine2: null,
    registeredCity: null,
    registeredRegion: null,
    registeredPostalCode: null,
    registeredCountryCode: null,
    paymentTermsDays: null,
    paymentTermsLabel: null,
    creditLimit: null,
    creditCurrency: null,
    defaultIncoterm: null,
    bookingConfirmationSlaHours: null,
    contacts: supplier.contacts.map((c) => redactContactRow(c)),
    offices: supplier.offices.map((o) => redactOfficeForApi(o)),
  } as T;
}
