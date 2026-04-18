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
    if (o.documentDate === null || o.documentDate === undefined || o.documentDate === "") {
      documentDate = null;
    } else if (typeof o.documentDate === "string") {
      const d = new Date(o.documentDate);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: "Invalid documentDate (expected ISO date)." };
      }
      documentDate = d;
    } else {
      return { ok: false, message: "Invalid documentDate." };
    }
  }
  return { ok: true, data: { title, category, referenceUrl, notes, documentDate } };
}

export type SupplierDocumentPatchData = {
  title?: string;
  category?: SupplierDocumentCategory;
  referenceUrl?: string | null;
  notes?: string | null;
  documentDate?: Date | null;
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
    if (o.documentDate === null || o.documentDate === "") {
      data.documentDate = null;
    } else if (typeof o.documentDate === "string") {
      const d = new Date(o.documentDate);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: "Invalid documentDate." };
      }
      data.documentDate = d;
    } else {
      return { ok: false, message: "Invalid documentDate." };
    }
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
