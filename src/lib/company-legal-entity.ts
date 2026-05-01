import type { CompanyLegalEntity, OrgUnitKind, Prisma } from "@prisma/client";

import { canActorAccessOrgUnitSubtree } from "@/lib/org-unit-admin-scope";
import { prisma } from "@/lib/prisma";

/**
 * In-tenant statutory profile lives in `CompanyLegalEntity` (Prisma) / `company_legal_entities` (DB).
 * Distinct from `TariffLegalEntity` (table `legal_entities`, tariff pricing).
 */
export function isOrgUnitKindLegalEntity(kind: OrgUnitKind): boolean {
  return kind === "LEGAL_ENTITY";
}

const MAX_LEGAL_NAME = 500;
const MAX_TRADE = 200;
const MAX_TAX = 80;
const MAX_ADDR = 200;
const MAX_PHONE = 64;
const MAX_EMAIL = 320;

const STATUS = new Set(["ACTIVE", "INACTIVE"]);

/** Validated input for `prisma.companyLegalEntity.create` (Phase 2 API). */
export type CompanyLegalEntityCreateInput = {
  orgUnitId: string;
  registeredLegalName: string;
  tradeName: string | null;
  taxVatId: string | null;
  taxLocalId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountryCode: string | null;
  phone: string | null;
  companyEmail: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  status: string;
};

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
}

function parseIsoDateKeyOptional(v: unknown): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "Date fields must be strings (YYYY-MM-DD) or null." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    return { ok: false, error: "Date fields must use YYYY-MM-DD format." };
  }
  const d = new Date(`${v.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date value." };
  return { ok: true, value: d };
}

function validateOptionalCountry(code: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (code == null) return { ok: true, value: null };
  if (code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) {
    return { ok: false, error: "addressCountryCode must be a 2-letter ISO code." };
  }
  return { ok: true, value: code.toUpperCase() };
}

/**
 * When `orgUnitId` is set, returns whether the actor may read/write company-legal data for that org node
 * (see `canActorAccessOrgUnitSubtree` in `org-unit-admin-scope.ts`).
 */
export async function canActorAccessOrgUnitForCompanyLegal(
  actorUserId: string,
  tenantId: string,
  orgUnitId: string,
): Promise<boolean> {
  return canActorAccessOrgUnitSubtree(actorUserId, tenantId, orgUnitId);
}

export function parseCreateCompanyLegalBody(
  body: unknown,
):
  | { ok: true; value: CompanyLegalEntityCreateInput }
  | { ok: false; error: string; code: "BAD_INPUT" } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object.", code: "BAD_INPUT" };
  }
  const o = body as Record<string, unknown>;
  const orgUnitId = typeof o.orgUnitId === "string" ? o.orgUnitId.trim() : "";
  const registered =
    typeof o.registeredLegalName === "string" ? o.registeredLegalName.trim() : "";
  if (!orgUnitId) {
    return { ok: false, error: "orgUnitId is required.", code: "BAD_INPUT" };
  }
  if (!registered) {
    return { ok: false, error: "registeredLegalName is required.", code: "BAD_INPUT" };
  }
  if (registered.length > MAX_LEGAL_NAME) {
    return {
      ok: false,
      error: `registeredLegalName must be at most ${MAX_LEGAL_NAME} characters.`,
      code: "BAD_INPUT",
    };
  }
  return finishParseOptionalFields(o, { orgUnitId, registeredLegalName: registered });
}

function finishParseOptionalFields(
  o: Record<string, unknown>,
  base: Pick<CompanyLegalEntityCreateInput, "orgUnitId" | "registeredLegalName">,
):
  | { ok: true; value: CompanyLegalEntityCreateInput }
  | { ok: false; error: string; code: "BAD_INPUT" } {
  const st = o.status;
  if (st !== undefined && (typeof st !== "string" || !STATUS.has(st))) {
    return { ok: false, error: "status must be ACTIVE or INACTIVE.", code: "BAD_INPUT" };
  }

  const effFrom = parseIsoDateKeyOptional(o.effectiveFrom);
  if (!effFrom.ok) return { ok: false, error: effFrom.error, code: "BAD_INPUT" };
  const effTo = parseIsoDateKeyOptional(o.effectiveTo);
  if (!effTo.ok) return { ok: false, error: effTo.error, code: "BAD_INPUT" };
  if (effFrom.value && effTo.value && effFrom.value.getTime() > effTo.value.getTime()) {
    return { ok: false, error: "effectiveFrom must be on or before effectiveTo.", code: "BAD_INPUT" };
  }

  const tname = trimOrNull(typeof o.tradeName === "string" ? o.tradeName : null);
  if (tname && tname.length > MAX_TRADE) {
    return { ok: false, error: `tradeName must be at most ${MAX_TRADE} characters.`, code: "BAD_INPUT" };
  }
  const taxVat = trimOrNull(typeof o.taxVatId === "string" ? o.taxVatId : null);
  const taxLocal = trimOrNull(typeof o.taxLocalId === "string" ? o.taxLocalId : null);
  if (taxVat && taxVat.length > MAX_TAX) {
    return { ok: false, error: `taxVatId must be at most ${MAX_TAX} characters.`, code: "BAD_INPUT" };
  }
  if (taxLocal && taxLocal.length > MAX_TAX) {
    return { ok: false, error: `taxLocalId must be at most ${MAX_TAX} characters.`, code: "BAD_INPUT" };
  }

  const a1 = trimOrNull(typeof o.addressLine1 === "string" ? o.addressLine1 : null);
  const a2 = trimOrNull(typeof o.addressLine2 === "string" ? o.addressLine2 : null);
  const ac = trimOrNull(typeof o.addressCity === "string" ? o.addressCity : null);
  const ar = trimOrNull(typeof o.addressRegion === "string" ? o.addressRegion : null);
  const ap = trimOrNull(typeof o.addressPostalCode === "string" ? o.addressPostalCode : null);

  const countryRaw = o.addressCountryCode;
  if (countryRaw !== undefined && countryRaw !== null && typeof countryRaw !== "string") {
    return { ok: false, error: "addressCountryCode must be a string or null.", code: "BAD_INPUT" };
  }
  const country = validateOptionalCountry(
    countryRaw === undefined || countryRaw === null || countryRaw === ""
      ? null
      : (countryRaw as string).trim().toUpperCase() || null,
  );
  if (!country.ok) return { ok: false, error: country.error, code: "BAD_INPUT" };

  const phone = trimOrNull(typeof o.phone === "string" ? o.phone : null);
  if (phone && phone.length > MAX_PHONE) {
    return { ok: false, error: `phone must be at most ${MAX_PHONE} characters.`, code: "BAD_INPUT" };
  }
  const companyEmail = trimOrNull(typeof o.companyEmail === "string" ? o.companyEmail : null);
  if (companyEmail && companyEmail.length > MAX_EMAIL) {
    return { ok: false, error: `companyEmail must be at most ${MAX_EMAIL} characters.`, code: "BAD_INPUT" };
  }
  if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
    return { ok: false, error: "companyEmail must be a valid email when set.", code: "BAD_INPUT" };
  }

  return {
    ok: true,
    value: {
      ...base,
      tradeName: tname,
      taxVatId: taxVat,
      taxLocalId: taxLocal,
      addressLine1: a1,
      addressLine2: a2,
      addressCity: ac,
      addressRegion: ar,
      addressPostalCode: ap,
      addressCountryCode: country.value,
      phone: phone,
      companyEmail: companyEmail,
      effectiveFrom: effFrom.value,
      effectiveTo: effTo.value,
      status: st === undefined ? "ACTIVE" : (st as string),
    },
  };
}

/**
 * For PATCH: only keys present in the body are updated; `null` clears optional string fields.
 */
export function parsePatchCompanyLegalBody(
  body: unknown,
):
  | { ok: true; value: Prisma.CompanyLegalEntityUpdateInput }
  | { ok: false; error: string; code: "BAD_INPUT" } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object.", code: "BAD_INPUT" };
  }
  const o = body as Record<string, unknown>;
  const out: Prisma.CompanyLegalEntityUpdateInput = {};

  if (Object.prototype.hasOwnProperty.call(o, "registeredLegalName")) {
    const v = typeof o.registeredLegalName === "string" ? o.registeredLegalName.trim() : "";
    if (!v) return { ok: false, error: "registeredLegalName cannot be empty when provided.", code: "BAD_INPUT" };
    if (v.length > MAX_LEGAL_NAME) {
      return {
        ok: false,
        error: `registeredLegalName must be at most ${MAX_LEGAL_NAME} characters.`,
        code: "BAD_INPUT",
      };
    }
    out.registeredLegalName = v;
  }
  if (Object.prototype.hasOwnProperty.call(o, "tradeName")) {
    if (o.tradeName !== null && typeof o.tradeName !== "string") {
      return { ok: false, error: "tradeName must be a string or null.", code: "BAD_INPUT" };
    }
    const t = o.tradeName === null ? null : (o.tradeName as string).trim();
    if (t && t.length > MAX_TRADE) {
      return { ok: false, error: `tradeName must be at most ${MAX_TRADE} characters.`, code: "BAD_INPUT" };
    }
    out.tradeName = t === "" || t === null ? null : t;
  }
  for (const key of ["taxVatId", "taxLocalId"] as const) {
    if (Object.prototype.hasOwnProperty.call(o, key)) {
      if (o[key] !== null && typeof o[key] !== "string") {
        return { ok: false, error: `${key} must be a string or null.`, code: "BAD_INPUT" };
      }
      const t = o[key] === null ? null : (o[key] as string).trim();
      if (t && t.length > MAX_TAX) {
        return { ok: false, error: `${key} is too long.`, code: "BAD_INPUT" };
      }
      out[key] = t === "" || t === null ? null : t;
    }
  }
  for (const [key, max] of [
    ["addressLine1", MAX_ADDR],
    ["addressLine2", MAX_ADDR],
    ["addressCity", MAX_ADDR],
    ["addressRegion", MAX_ADDR],
    ["addressPostalCode", 32],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(o, key)) {
      if (o[key] !== null && typeof o[key] !== "string") {
        return { ok: false, error: `${key} must be a string or null.`, code: "BAD_INPUT" };
      }
      const t = o[key] === null ? null : (o[key] as string).trim();
      if (t && t.length > max) {
        return { ok: false, error: `${key} is too long.`, code: "BAD_INPUT" };
      }
      (out as Record<string, unknown>)[key] = t === "" || t === null ? null : t;
    }
  }
  if (Object.prototype.hasOwnProperty.call(o, "addressCountryCode")) {
    if (o.addressCountryCode !== null && typeof o.addressCountryCode !== "string") {
      return { ok: false, error: "addressCountryCode must be a string or null.", code: "BAD_INPUT" };
    }
    const raw =
      o.addressCountryCode === null || o.addressCountryCode === ""
        ? null
        : (o.addressCountryCode as string).trim().toUpperCase();
    const c = validateOptionalCountry(raw);
    if (!c.ok) return { ok: false, error: c.error, code: "BAD_INPUT" };
    out.addressCountryCode = c.value;
  }
  if (Object.prototype.hasOwnProperty.call(o, "phone")) {
    if (o.phone !== null && typeof o.phone !== "string") {
      return { ok: false, error: "phone must be a string or null.", code: "BAD_INPUT" };
    }
    const t = o.phone === null ? null : (o.phone as string).trim();
    if (t && t.length > MAX_PHONE) {
      return { ok: false, error: `phone must be at most ${MAX_PHONE} characters.`, code: "BAD_INPUT" };
    }
    out.phone = t === "" || t === null ? null : t;
  }
  if (Object.prototype.hasOwnProperty.call(o, "companyEmail")) {
    if (o.companyEmail !== null && typeof o.companyEmail !== "string") {
      return { ok: false, error: "companyEmail must be a string or null.", code: "BAD_INPUT" };
    }
    const t = o.companyEmail === null ? null : (o.companyEmail as string).trim();
    if (t && t.length > MAX_EMAIL) {
      return { ok: false, error: `companyEmail must be at most ${MAX_EMAIL} characters.`, code: "BAD_INPUT" };
    }
    if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      return { ok: false, error: "companyEmail must be a valid email when set.", code: "BAD_INPUT" };
    }
    out.companyEmail = t === "" || t === null ? null : t;
  }
  if (Object.prototype.hasOwnProperty.call(o, "status")) {
    if (typeof o.status !== "string" || !STATUS.has(o.status)) {
      return { ok: false, error: "status must be ACTIVE or INACTIVE.", code: "BAD_INPUT" };
    }
    out.status = o.status;
  }
  if (Object.prototype.hasOwnProperty.call(o, "effectiveFrom")) {
    const p = parseIsoDateKeyOptional(o.effectiveFrom);
    if (!p.ok) return { ok: false, error: p.error, code: "BAD_INPUT" };
    out.effectiveFrom = p.value;
  }
  if (Object.prototype.hasOwnProperty.call(o, "effectiveTo")) {
    const p = parseIsoDateKeyOptional(o.effectiveTo);
    if (!p.ok) return { ok: false, error: p.error, code: "BAD_INPUT" };
    out.effectiveTo = p.value;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, error: "No valid fields to update.", code: "BAD_INPUT" };
  }

  return { ok: true, value: out };
}

/** After applying a patch, ensure effective range remains valid. */
export function assertMergedEffectiveDateRange(
  existing: { effectiveFrom: Date | null; effectiveTo: Date | null },
  patch: Prisma.CompanyLegalEntityUpdateInput,
): { ok: true } | { ok: false; error: string } {
  const from =
    Object.prototype.hasOwnProperty.call(patch, "effectiveFrom") ?
      (patch.effectiveFrom as Date | null)
    : existing.effectiveFrom;
  const to =
    Object.prototype.hasOwnProperty.call(patch, "effectiveTo") ?
      (patch.effectiveTo as Date | null)
    : existing.effectiveTo;
  if (from && to && from.getTime() > to.getTime()) {
    return { ok: false, error: "effectiveFrom must be on or before effectiveTo." };
  }
  return { ok: true };
}

type CleWithOrg = CompanyLegalEntity & {
  orgUnit: { id: string; name: string; code: string; kind: OrgUnitKind };
};

export function serializeCompanyLegalEntity(row: CleWithOrg) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgUnitId: row.orgUnitId,
    registeredLegalName: row.registeredLegalName,
    tradeName: row.tradeName,
    taxVatId: row.taxVatId,
    taxLocalId: row.taxLocalId,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    addressCity: row.addressCity,
    addressRegion: row.addressRegion,
    addressPostalCode: row.addressPostalCode,
    addressCountryCode: row.addressCountryCode,
    phone: row.phone,
    companyEmail: row.companyEmail,
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString().slice(0, 10) : null,
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    orgUnit: {
      id: row.orgUnit.id,
      name: row.orgUnit.name,
      code: row.orgUnit.code,
      kind: row.orgUnit.kind,
    },
  };
}

export type SerializedCompanyLegalEntity = ReturnType<typeof serializeCompanyLegalEntity>;

/**
 * @returns `null` if the row is missing, or the actor is not in scope.
 */
export async function loadCompanyLegalEntityForActor(
  id: string,
  tenantId: string,
  actorUserId: string,
): Promise<CleWithOrg | null> {
  const row = await prisma.companyLegalEntity.findFirst({
    where: { id, tenantId },
    include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
  });
  if (!row) return null;
  const ok = await canActorAccessOrgUnitForCompanyLegal(actorUserId, tenantId, row.orgUnitId);
  if (!ok) return null;
  return row;
}
