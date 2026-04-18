/**
 * Inbound integration shape for supplier master upserts (control tower / ERP / sync jobs).
 * See `docs/srm/md/srm_integration_and_api_payload_pack.md` — Supplier Master Upsert minimum fields.
 * Parsing only: callers map into Prisma and enforce tenant auth / onboarding rules separately.
 */

const MAX_SUPPLIER_CODE_LEN = 64;
const MAX_LEGAL_NAME_LEN = 512;
const MAX_ENTITY_LEN = 512;

const ALLOWED_STATUS = new Set([
  "active",
  "inactive",
  "pending_approval",
  "approved",
  "rejected",
  "suspended",
]);

export type SupplierMasterUpsertPayload = {
  supplierCode: string;
  legalName: string | null;
  entity: string | null;
  countryCode: string | null;
  srmCategory: "product" | "logistics" | null;
  /** Normalized hint for downstream mapping (not a Prisma enum). */
  integrationStatus: string | null;
};

export type ParseSupplierMasterUpsertPayloadResult =
  | { ok: true; data: SupplierMasterUpsertPayload }
  | { ok: false; message: string };

function pick(
  o: Record<string, unknown>,
  snake: string,
  camel: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(o, camel)) return o[camel];
  if (Object.prototype.hasOwnProperty.call(o, snake)) return o[snake];
  return undefined;
}

function parseOptionalTrimmedString(
  raw: unknown,
  maxLen: number,
  label: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: `Invalid ${label} (expected string).` };
  }
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  if (t.length > maxLen) {
    return { ok: false, message: `${label} is too long.` };
  }
  return { ok: true, value: t };
}

function parseCountry(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Invalid country (expected string)." };
  }
  const t = raw.trim();
  if (!t) return { ok: true, value: null };
  if (t.length !== 2 || !/^[A-Za-z]{2}$/.test(t)) {
    return { ok: false, message: "country must be a 2-letter ISO 3166-1 alpha-2 code." };
  }
  return { ok: true, value: t.toUpperCase() };
}

function parseCategory(
  raw: unknown,
): { ok: true; value: "product" | "logistics" | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Invalid category (expected string)." };
  }
  const t = raw.trim().toLowerCase();
  if (!t) return { ok: true, value: null };
  if (t === "product") return { ok: true, value: "product" };
  if (t === "logistics") return { ok: true, value: "logistics" };
  return { ok: false, message: 'category must be "product" or "logistics".' };
}

function parseStatus(raw: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Invalid status (expected string)." };
  }
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!t) return { ok: true, value: null };
  const normalized =
    t === "pending" ? "pending_approval" : t === "pending-approval" ? "pending_approval" : t;
  if (!ALLOWED_STATUS.has(normalized)) {
    return {
      ok: false,
      message: `status must be one of: ${[...ALLOWED_STATUS].sort().join(", ")}.`,
    };
  }
  return { ok: true, value: normalized };
}

/**
 * Parse JSON object body from an external system (snake_case keys preferred; camelCase accepted for code).
 */
export function parseSupplierMasterUpsertPayload(
  o: Record<string, unknown>,
): ParseSupplierMasterUpsertPayloadResult {
  const codeRaw = pick(o, "supplier_code", "supplierCode");
  if (codeRaw === null || codeRaw === undefined) {
    return { ok: false, message: "supplier_code is required." };
  }
  if (typeof codeRaw !== "string" || !codeRaw.trim()) {
    return { ok: false, message: "supplier_code is required." };
  }
  const supplierCode = codeRaw.trim();
  if (supplierCode.length > MAX_SUPPLIER_CODE_LEN) {
    return { ok: false, message: "supplier_code is too long." };
  }

  const legal = parseOptionalTrimmedString(pick(o, "legal_name", "legalName"), MAX_LEGAL_NAME_LEN, "legal_name");
  if (!legal.ok) return legal;

  const entity = parseOptionalTrimmedString(pick(o, "entity", "entity"), MAX_ENTITY_LEN, "entity");
  if (!entity.ok) return entity;

  const country = parseCountry(pick(o, "country", "country"));
  if (!country.ok) return country;

  const category = parseCategory(pick(o, "category", "category"));
  if (!category.ok) return category;

  const status = parseStatus(pick(o, "status", "status"));
  if (!status.ok) return status;

  return {
    ok: true,
    data: {
      supplierCode,
      legalName: legal.value,
      entity: entity.value,
      countryCode: country.value,
      srmCategory: category.value,
      integrationStatus: status.value,
    },
  };
}
