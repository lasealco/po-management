import type { SupplierContractRecordStatus } from "@prisma/client";

const STATUSES: SupplierContractRecordStatus[] = ["draft", "active", "expired", "terminated"];

function isStatus(v: string): v is SupplierContractRecordStatus {
  return STATUSES.includes(v as SupplierContractRecordStatus);
}

function normalizeReferenceUrl(raw: string): string | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 2000) return undefined;
  const lower = t.toLowerCase();
  if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
    return undefined;
  }
  return t;
}

export type ContractRecordCreateData = {
  title: string;
  externalReference: string | null;
  status: SupplierContractRecordStatus;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  notes: string | null;
  referenceUrl: string | null;
};

export type ParseContractRecordCreateResult =
  | { ok: true; data: ContractRecordCreateData }
  | { ok: false; message: string };

export function parseContractRecordCreateBody(
  o: Record<string, unknown>,
): ParseContractRecordCreateResult {
  if (typeof o.title !== "string" || !o.title.trim()) {
    return { ok: false, message: "title is required." };
  }
  const title = o.title.trim().slice(0, 256);

  let externalReference: string | null = null;
  if ("externalReference" in o) {
    if (o.externalReference === null || o.externalReference === undefined) {
      externalReference = null;
    } else if (typeof o.externalReference === "string") {
      const t = o.externalReference.trim().slice(0, 128);
      externalReference = t || null;
    } else {
      return { ok: false, message: "Invalid externalReference." };
    }
  }

  let status: SupplierContractRecordStatus = "draft";
  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !isStatus(o.status)) {
      return { ok: false, message: "status must be draft, active, expired, or terminated." };
    }
    status = o.status;
  }

  const parseDate = (key: string, v: unknown): { ok: true; d: Date | null } | { ok: false; message: string } => {
    if (v === null || v === undefined || v === "") return { ok: true, d: null };
    if (typeof v !== "string") return { ok: false, message: `Invalid ${key}.` };
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { ok: false, message: `Invalid ${key} (ISO date expected).` };
    return { ok: true, d };
  };

  let effectiveFrom: Date | null = null;
  if ("effectiveFrom" in o) {
    const p = parseDate("effectiveFrom", o.effectiveFrom);
    if (!p.ok) return p;
    effectiveFrom = p.d;
  }
  let effectiveTo: Date | null = null;
  if ("effectiveTo" in o) {
    const p = parseDate("effectiveTo", o.effectiveTo);
    if (!p.ok) return p;
    effectiveTo = p.d;
  }

  let notes: string | null = null;
  if ("notes" in o) {
    if (o.notes === null) notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      notes = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid notes." };
    }
  }

  let referenceUrl: string | null = null;
  if ("referenceUrl" in o) {
    if (o.referenceUrl === null || o.referenceUrl === undefined) {
      referenceUrl = null;
    } else if (typeof o.referenceUrl === "string") {
      const n = normalizeReferenceUrl(o.referenceUrl);
      if (n === undefined && o.referenceUrl.trim()) {
        return {
          ok: false,
          message: "referenceUrl must be empty or a http(s) URL (max 2000 characters).",
        };
      }
      referenceUrl = n ?? null;
    } else {
      return { ok: false, message: "Invalid referenceUrl." };
    }
  }

  return {
    ok: true,
    data: {
      title,
      externalReference,
      status,
      effectiveFrom,
      effectiveTo,
      notes,
      referenceUrl,
    },
  };
}

export type ContractRecordPatchData = {
  title?: string;
  externalReference?: string | null;
  status?: SupplierContractRecordStatus;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  notes?: string | null;
  referenceUrl?: string | null;
};

export type ParseContractRecordPatchResult =
  | { ok: true; data: ContractRecordPatchData }
  | { ok: false; message: string };

export function parseContractRecordPatchBody(
  o: Record<string, unknown>,
): ParseContractRecordPatchResult {
  const data: ContractRecordPatchData = {};
  if ("title" in o) {
    if (typeof o.title !== "string" || !o.title.trim()) {
      return { ok: false, message: "title cannot be empty." };
    }
    data.title = o.title.trim().slice(0, 256);
  }
  if ("externalReference" in o) {
    if (o.externalReference === null) data.externalReference = null;
    else if (typeof o.externalReference === "string") {
      const t = o.externalReference.trim().slice(0, 128);
      data.externalReference = t || null;
    } else {
      return { ok: false, message: "Invalid externalReference." };
    }
  }
  if ("status" in o) {
    if (typeof o.status !== "string" || !isStatus(o.status)) {
      return { ok: false, message: "status must be draft, active, expired, or terminated." };
    }
    data.status = o.status;
  }
  const parseDate = (key: string, v: unknown): { ok: true; d: Date | null } | { ok: false; message: string } => {
    if (v === null || v === "") return { ok: true, d: null };
    if (typeof v !== "string") return { ok: false, message: `Invalid ${key}.` };
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { ok: false, message: `Invalid ${key}.` };
    return { ok: true, d };
  };
  if ("effectiveFrom" in o) {
    const p = parseDate("effectiveFrom", o.effectiveFrom);
    if (!p.ok) return p;
    data.effectiveFrom = p.d;
  }
  if ("effectiveTo" in o) {
    const p = parseDate("effectiveTo", o.effectiveTo);
    if (!p.ok) return p;
    data.effectiveTo = p.d;
  }
  if ("notes" in o) {
    if (o.notes === null) data.notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      data.notes = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid notes." };
    }
  }
  if ("referenceUrl" in o) {
    if (o.referenceUrl === null) data.referenceUrl = null;
    else if (typeof o.referenceUrl === "string") {
      const n = normalizeReferenceUrl(o.referenceUrl);
      if (n === undefined && o.referenceUrl.trim()) {
        return {
          ok: false,
          message: "referenceUrl must be empty or a http(s) URL (max 2000 characters).",
        };
      }
      data.referenceUrl = n ?? null;
    } else {
      return { ok: false, message: "Invalid referenceUrl." };
    }
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
