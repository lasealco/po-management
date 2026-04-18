import type { SupplierDocumentCategory } from "@prisma/client";

const CATEGORIES: SupplierDocumentCategory[] = [
  "insurance",
  "license",
  "certificate",
  "compliance_other",
  "commercial_other",
];

function isCategory(v: string): v is SupplierDocumentCategory {
  return CATEGORIES.includes(v as SupplierDocumentCategory);
}

function parseOptionalIsoDate(
  value: unknown,
  fieldLabel: string,
): { ok: true; date: Date | null } | { ok: false; message: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, date: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `Invalid ${fieldLabel}.` };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, message: `Invalid ${fieldLabel} (expected ISO date).` };
  }
  return { ok: true, date: d };
}

function normalizeReferenceUrl(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.length > 2000) return undefined;
  const lower = t.toLowerCase();
  if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
    return undefined;
  }
  return t;
}

export type SupplierDocumentCreateData = {
  title: string;
  category: SupplierDocumentCategory;
  referenceUrl: string | null;
  notes: string | null;
  documentDate: Date | null;
  expiresAt: Date | null;
};

export type ParseSupplierDocumentCreateResult =
  | { ok: true; data: SupplierDocumentCreateData }
  | { ok: false; message: string };

export function parseSupplierDocumentCreateBody(
  o: Record<string, unknown>,
): ParseSupplierDocumentCreateResult {
  if (typeof o.title !== "string" || !o.title.trim()) {
    return { ok: false, message: "title is required." };
  }
  const title = o.title.trim().slice(0, 256);
  let category: SupplierDocumentCategory = "compliance_other";
  if (o.category !== undefined) {
    if (typeof o.category !== "string" || !isCategory(o.category)) {
      return {
        ok: false,
        message: "category must be insurance, license, certificate, compliance_other, or commercial_other.",
      };
    }
    category = o.category;
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
  let documentDate: Date | null = null;
  if ("documentDate" in o) {
    const p = parseOptionalIsoDate(o.documentDate, "documentDate");
    if (!p.ok) return p;
    documentDate = p.date;
  }
  let expiresAt: Date | null = null;
  if ("expiresAt" in o) {
    const p = parseOptionalIsoDate(o.expiresAt, "expiresAt");
    if (!p.ok) return p;
    expiresAt = p.date;
  }
  return { ok: true, data: { title, category, referenceUrl, notes, documentDate, expiresAt } };
}

export type SupplierDocumentPatchData = {
  title?: string;
  category?: SupplierDocumentCategory;
  referenceUrl?: string | null;
  notes?: string | null;
  documentDate?: Date | null;
  expiresAt?: Date | null;
  /** Set via API body `{ archived: true }` (now) or `{ archived: false }` (clear). */
  archivedAt?: Date | null;
};

export type ParseSupplierDocumentPatchResult =
  | { ok: true; data: SupplierDocumentPatchData }
  | { ok: false; message: string };

export function parseSupplierDocumentPatchBody(
  o: Record<string, unknown>,
): ParseSupplierDocumentPatchResult {
  const data: SupplierDocumentPatchData = {};
  if ("title" in o) {
    if (typeof o.title !== "string" || !o.title.trim()) {
      return { ok: false, message: "title cannot be empty." };
    }
    data.title = o.title.trim().slice(0, 256);
  }
  if ("category" in o) {
    if (typeof o.category !== "string" || !isCategory(o.category)) {
      return {
        ok: false,
        message: "category must be insurance, license, certificate, compliance_other, or commercial_other.",
      };
    }
    data.category = o.category;
  }
  if ("referenceUrl" in o) {
    if (o.referenceUrl === null) {
      data.referenceUrl = null;
    } else if (typeof o.referenceUrl === "string") {
      const n = normalizeReferenceUrl(o.referenceUrl);
      if (n === undefined && o.referenceUrl.trim()) {
        return {
          ok: false,
          message: "referenceUrl must be empty or a http(s) URL (max 2000 characters).",
        };
      }
      data.referenceUrl = n === undefined ? null : n;
    } else {
      return { ok: false, message: "Invalid referenceUrl." };
    }
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
  if ("documentDate" in o) {
    const p = parseOptionalIsoDate(o.documentDate, "documentDate");
    if (!p.ok) return p;
    data.documentDate = p.date;
  }
  if ("expiresAt" in o) {
    const p = parseOptionalIsoDate(o.expiresAt, "expiresAt");
    if (!p.ok) return p;
    data.expiresAt = p.date;
  }
  if ("archived" in o) {
    if (typeof o.archived !== "boolean") {
      return { ok: false, message: "archived must be a boolean." };
    }
    data.archivedAt = o.archived ? new Date() : null;
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
