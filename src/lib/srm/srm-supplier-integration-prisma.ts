import { Prisma, SrmSupplierCategory, SupplierApprovalStatus } from "@prisma/client";

import { optionalStringField } from "@/lib/supplier-patch";
import { assertSupplierApprovalTransition } from "@/lib/srm/supplier-approval-transitions";

export type IntegrationFieldError = { error: string; code: string; status: number };

/**
 * Maps `supplier` JSON from `srm_supplier_upsert_v1` to Prisma update input (aligned with `PATCH /api/suppliers/[id]`).
 */
export function buildSupplierUpdateInputFromIntegrationJson(
  o: Record<string, unknown>,
  existingApproval: SupplierApprovalStatus,
  canApprove: boolean,
): { ok: true; data: Prisma.SupplierUpdateInput } | { ok: false; err: IntegrationFieldError } {
  if (
    (o.isActive !== undefined || o.approvalStatus !== undefined) &&
    !canApprove
  ) {
    return {
      ok: false,
      err: {
        error: "Changing activation or approval status requires org.suppliers → approve.",
        code: "FORBIDDEN",
        status: 403,
      },
    };
  }

  const data: Prisma.SupplierUpdateInput = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return { ok: false, err: { error: "Invalid name.", code: "BAD_INPUT", status: 400 } };
    }
    data.name = o.name.trim();
  }
  if (o.code !== undefined) {
    data.code = typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  }
  if (o.email !== undefined) {
    data.email = typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  }
  if (o.phone !== undefined) {
    data.phone = typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  }
  if (o.isActive !== undefined) {
    data.isActive = Boolean(o.isActive);
  }

  if (o.approvalStatus !== undefined) {
    const v = o.approvalStatus;
    if (v === SupplierApprovalStatus.pending_approval) {
      data.approvalStatus = SupplierApprovalStatus.pending_approval;
    } else if (v === SupplierApprovalStatus.approved) {
      data.approvalStatus = SupplierApprovalStatus.approved;
    } else if (v === SupplierApprovalStatus.rejected) {
      data.approvalStatus = SupplierApprovalStatus.rejected;
    } else if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "pending_approval") data.approvalStatus = SupplierApprovalStatus.pending_approval;
      else if (t === "approved") data.approvalStatus = SupplierApprovalStatus.approved;
      else if (t === "rejected") data.approvalStatus = SupplierApprovalStatus.rejected;
      else {
        return { ok: false, err: { error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 } };
      }
    } else {
      return { ok: false, err: { error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 } };
    }
  }

  if (o.srmCategory !== undefined) {
    const v = o.srmCategory;
    if (v === SrmSupplierCategory.product || v === SrmSupplierCategory.logistics) {
      data.srmCategory = v;
    } else if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (t === "product") data.srmCategory = SrmSupplierCategory.product;
      else if (t === "logistics") data.srmCategory = SrmSupplierCategory.logistics;
      else {
        return { ok: false, err: { error: "Invalid srmCategory.", code: "BAD_INPUT", status: 400 } };
      }
    } else {
      return { ok: false, err: { error: "Invalid srmCategory.", code: "BAD_INPUT", status: 400 } };
    }
  }

  const stringKeys = [
    "legalName",
    "taxId",
    "website",
    "registeredAddressLine1",
    "registeredAddressLine2",
    "registeredCity",
    "registeredRegion",
    "registeredPostalCode",
    "paymentTermsLabel",
    "defaultIncoterm",
    "internalNotes",
  ] as const;
  for (const key of stringKeys) {
    const v = optionalStringField(o, key);
    if (v !== undefined) data[key] = v;
  }

  if ("registeredCountryCode" in o) {
    const v = o.registeredCountryCode;
    if (v === null) {
      data.registeredCountryCode = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      data.registeredCountryCode = t.length === 2 ? t : null;
    } else {
      return { ok: false, err: { error: "Invalid registeredCountryCode.", code: "BAD_INPUT", status: 400 } };
    }
  }

  if ("creditCurrency" in o) {
    const v = o.creditCurrency;
    if (v === null) {
      data.creditCurrency = null;
    } else if (typeof v === "string") {
      const t = v.trim().toUpperCase();
      if (t.length !== 3 && t.length !== 0) {
        return { ok: false, err: { error: "creditCurrency must be a 3-letter ISO code.", code: "BAD_INPUT", status: 400 } };
      }
      data.creditCurrency = t.length ? t : null;
    } else {
      return { ok: false, err: { error: "Invalid creditCurrency.", code: "BAD_INPUT", status: 400 } };
    }
  }

  if ("paymentTermsDays" in o) {
    const v = o.paymentTermsDays;
    if (v === null) {
      data.paymentTermsDays = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3650) {
      data.paymentTermsDays = v;
    } else {
      return { ok: false, err: { error: "Invalid paymentTermsDays.", code: "BAD_INPUT", status: 400 } };
    }
  }

  if ("bookingConfirmationSlaHours" in o) {
    const v = o.bookingConfirmationSlaHours;
    if (v === null) {
      data.bookingConfirmationSlaHours = null;
    } else if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 8760) {
      data.bookingConfirmationSlaHours = v;
    } else {
      return {
        ok: false,
        err: {
          error: "bookingConfirmationSlaHours must be null or an integer from 1 to 8760.",
          code: "BAD_INPUT",
          status: 400,
        },
      };
    }
  }

  if ("creditLimit" in o) {
    const v = o.creditLimit;
    if (v === null) {
      data.creditLimit = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      data.creditLimit = new Prisma.Decimal(v);
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        data.creditLimit = null;
      } else {
        try {
          const d = new Prisma.Decimal(t);
          if (d.lt(0)) {
            return { ok: false, err: { error: "creditLimit must be non-negative.", code: "BAD_INPUT", status: 400 } };
          }
          data.creditLimit = d;
        } catch {
          return { ok: false, err: { error: "Invalid creditLimit.", code: "BAD_INPUT", status: 400 } };
        }
      }
    } else {
      return { ok: false, err: { error: "Invalid creditLimit.", code: "BAD_INPUT", status: 400 } };
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, err: { error: "No valid fields to update.", code: "BAD_INPUT", status: 400 } };
  }

  if (data.approvalStatus !== undefined) {
    const transition = assertSupplierApprovalTransition(
      existingApproval,
      data.approvalStatus as SupplierApprovalStatus,
    );
    if (!transition.ok) {
      return { ok: false, err: { error: transition.error, code: "BAD_INPUT", status: 400 } };
    }
  }

  return { ok: true, data };
}

/**
 * Create payload (aligned with `POST /api/suppliers`) for integration create / upsert-by-code miss.
 * Caller must set `tenantId` on the unchecked create input.
 */
export function buildSupplierCreateDataFromIntegrationJson(
  o: Record<string, unknown>,
  canApprove: boolean,
):
  | { ok: true; data: Omit<Prisma.SupplierUncheckedCreateInput, "tenantId"> }
  | { ok: false; err: IntegrationFieldError } {
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!name) {
    return { ok: false, err: { error: "supplier.name is required to create a supplier.", code: "BAD_INPUT", status: 400 } };
  }
  if (
    (o.isActive !== undefined || o.approvalStatus !== undefined) &&
    !canApprove
  ) {
    return {
      ok: false,
      err: {
        error: "Setting activation or approval status on create requires org.suppliers → approve.",
        code: "FORBIDDEN",
        status: 403,
      },
    };
  }

  const code = typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  const email = typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  const phone = typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  const legalName = typeof o.legalName === "string" && o.legalName.trim() ? o.legalName.trim() : null;
  const website = typeof o.website === "string" && o.website.trim() ? o.website.trim() : null;
  const taxId = typeof o.taxId === "string" && o.taxId.trim() ? o.taxId.trim() : null;
  const registeredAddressLine1 =
    typeof o.registeredAddressLine1 === "string" && o.registeredAddressLine1.trim()
      ? o.registeredAddressLine1.trim()
      : null;
  const registeredAddressLine2 = optionalStringField(o, "registeredAddressLine2") ?? null;
  const registeredCity = typeof o.registeredCity === "string" && o.registeredCity.trim() ? o.registeredCity.trim() : null;
  const registeredRegion =
    typeof o.registeredRegion === "string" && o.registeredRegion.trim() ? o.registeredRegion.trim() : null;
  const registeredPostalCode =
    typeof o.registeredPostalCode === "string" && o.registeredPostalCode.trim()
      ? o.registeredPostalCode.trim()
      : null;
  const rawCountry = typeof o.registeredCountryCode === "string" ? o.registeredCountryCode.trim().toUpperCase() : "";
  const registeredCountryCode = rawCountry ? rawCountry.slice(0, 2) : null;
  const paymentTermsLabel =
    typeof o.paymentTermsLabel === "string" && o.paymentTermsLabel.trim() ? o.paymentTermsLabel.trim() : null;
  const rawPaymentTermsDays =
    o.paymentTermsDays == null || o.paymentTermsDays === "" ? null : Number.parseInt(String(o.paymentTermsDays), 10);
  if (
    rawPaymentTermsDays != null &&
    (!Number.isFinite(rawPaymentTermsDays) || rawPaymentTermsDays < 0 || rawPaymentTermsDays > 3650)
  ) {
    return {
      ok: false,
      err: { error: "paymentTermsDays must be a whole number between 0 and 3650.", code: "BAD_INPUT", status: 400 },
    };
  }
  const defaultIncoterm =
    typeof o.defaultIncoterm === "string" && o.defaultIncoterm.trim() ? o.defaultIncoterm.trim().toUpperCase() : null;
  const srmCategoryRaw = typeof o.srmCategory === "string" ? o.srmCategory.trim().toLowerCase() : "";
  const srmCategory: SrmSupplierCategory =
    srmCategoryRaw === "logistics" ? SrmSupplierCategory.logistics : SrmSupplierCategory.product;

  const data: Omit<Prisma.SupplierUncheckedCreateInput, "tenantId"> = {
    name,
    code,
    email,
    phone,
    legalName,
    website,
    taxId,
    registeredAddressLine1,
    registeredAddressLine2: registeredAddressLine2,
    registeredCity,
    registeredRegion,
    registeredPostalCode,
    registeredCountryCode,
    paymentTermsLabel,
    paymentTermsDays: rawPaymentTermsDays,
    defaultIncoterm,
    srmCategory,
    ...(canApprove
      ? { approvalStatus: SupplierApprovalStatus.approved, isActive: true }
      : { approvalStatus: SupplierApprovalStatus.pending_approval, isActive: false }),
  };

  if (o.approvalStatus !== undefined || o.isActive !== undefined) {
    if (!canApprove) {
      return {
        ok: false,
        err: {
          error: "org.suppliers → approve is required to set approval or activation on create.",
          code: "FORBIDDEN",
          status: 403,
        },
      };
    }
    if (o.isActive !== undefined) data.isActive = Boolean(o.isActive);
    if (o.approvalStatus !== undefined) {
      const v = o.approvalStatus;
      if (typeof v === "string") {
        const t = v.trim().toLowerCase();
        if (t === "pending_approval") data.approvalStatus = SupplierApprovalStatus.pending_approval;
        else if (t === "approved") data.approvalStatus = SupplierApprovalStatus.approved;
        else if (t === "rejected") data.approvalStatus = SupplierApprovalStatus.rejected;
        else
          return { ok: false, err: { error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 } };
      } else {
        return { ok: false, err: { error: "Invalid approvalStatus.", code: "BAD_INPUT", status: 400 } };
      }
    }
  }

  if (o.internalNotes !== undefined) {
    const v = optionalStringField(o, "internalNotes");
    if (v !== undefined) data.internalNotes = v;
  }
  if (o.creditLimit !== undefined) {
    const v = o.creditLimit;
    if (v === null) {
      data.creditLimit = null;
    } else if (typeof v === "number" && v >= 0) {
      data.creditLimit = new Prisma.Decimal(v);
    } else
      return { ok: false, err: { error: "Invalid creditLimit on create.", code: "BAD_INPUT", status: 400 } };
  }
  if (o.creditCurrency !== undefined && typeof o.creditCurrency === "string") {
    const t = o.creditCurrency.trim().toUpperCase();
    if (t.length === 3) data.creditCurrency = t;
  }
  if (o.bookingConfirmationSlaHours !== undefined && o.bookingConfirmationSlaHours !== null) {
    const h = o.bookingConfirmationSlaHours;
    if (typeof h === "number" && Number.isInteger(h) && h >= 1 && h <= 8760) {
      data.bookingConfirmationSlaHours = h;
    } else
      return { ok: false, err: { error: "Invalid bookingConfirmationSlaHours on create.", code: "BAD_INPUT", status: 400 } };
  }

  return { ok: true, data };
}
