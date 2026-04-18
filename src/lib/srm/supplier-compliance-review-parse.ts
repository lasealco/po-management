import type { SupplierComplianceReviewOutcome } from "@prisma/client";

const OUTCOMES: SupplierComplianceReviewOutcome[] = [
  "satisfactory",
  "action_required",
  "failed",
];

function isOutcome(v: string): v is SupplierComplianceReviewOutcome {
  return OUTCOMES.includes(v as SupplierComplianceReviewOutcome);
}

function parseIsoDate(key: string, v: unknown): { ok: true; d: Date } | { ok: false; message: string } {
  if (v === undefined || v === null) return { ok: false, message: `${key} is required for this operation.` };
  if (typeof v !== "string") return { ok: false, message: `Invalid ${key}.` };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { ok: false, message: `Invalid ${key} (expected ISO date).` };
  return { ok: true, d };
}

function parseOptionalIso(
  key: string,
  v: unknown,
): { ok: true; d: Date | null | undefined } | { ok: false; message: string } {
  if (v === undefined) return { ok: true, d: undefined };
  if (v === null) return { ok: true, d: null };
  if (typeof v !== "string") return { ok: false, message: `Invalid ${key}.` };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { ok: false, message: `Invalid ${key} (expected ISO date).` };
  return { ok: true, d };
}

export type ComplianceReviewCreateData = {
  outcome: SupplierComplianceReviewOutcome;
  summary: string;
  reviewedAt: Date;
  nextReviewDue: Date | null;
};

export type ParseComplianceReviewCreateResult =
  | { ok: true; data: ComplianceReviewCreateData }
  | { ok: false; message: string };

export function parseComplianceReviewCreateBody(
  o: Record<string, unknown>,
): ParseComplianceReviewCreateResult {
  if (typeof o.summary !== "string" || !o.summary.trim()) {
    return { ok: false, message: "summary is required." };
  }
  const summary = o.summary.trim().slice(0, 16000);
  if (typeof o.outcome !== "string" || !isOutcome(o.outcome)) {
    return { ok: false, message: "outcome must be satisfactory, action_required, or failed." };
  }
  const outcome = o.outcome;
  let reviewedAt = new Date();
  if ("reviewedAt" in o && o.reviewedAt !== undefined) {
    if (o.reviewedAt === null) {
      return { ok: false, message: "reviewedAt cannot be null." };
    }
    const p = parseIsoDate("reviewedAt", o.reviewedAt);
    if (!p.ok) return p;
    reviewedAt = p.d;
  }
  let nextReviewDue: Date | null = null;
  if ("nextReviewDue" in o) {
    const p = parseOptionalIso("nextReviewDue", o.nextReviewDue);
    if (!p.ok) return p;
    nextReviewDue = p.d === undefined ? null : p.d;
  }
  return { ok: true, data: { outcome, summary, reviewedAt, nextReviewDue } };
}

export type ComplianceReviewPatchData = {
  outcome?: SupplierComplianceReviewOutcome;
  summary?: string;
  reviewedAt?: Date;
  nextReviewDue?: Date | null;
};

export type ParseComplianceReviewPatchResult =
  | { ok: true; data: ComplianceReviewPatchData }
  | { ok: false; message: string };

export function parseComplianceReviewPatchBody(
  o: Record<string, unknown>,
): ParseComplianceReviewPatchResult {
  const data: ComplianceReviewPatchData = {};
  if ("outcome" in o) {
    if (typeof o.outcome !== "string" || !isOutcome(o.outcome)) {
      return { ok: false, message: "outcome must be satisfactory, action_required, or failed." };
    }
    data.outcome = o.outcome;
  }
  if ("summary" in o) {
    if (typeof o.summary !== "string" || !o.summary.trim()) {
      return { ok: false, message: "summary cannot be empty." };
    }
    data.summary = o.summary.trim().slice(0, 16000);
  }
  if ("reviewedAt" in o) {
    if (o.reviewedAt === null) {
      return { ok: false, message: "reviewedAt cannot be null." };
    }
    const p = parseIsoDate("reviewedAt", o.reviewedAt);
    if (!p.ok) return p;
    data.reviewedAt = p.d;
  }
  if ("nextReviewDue" in o) {
    const p = parseOptionalIso("nextReviewDue", o.nextReviewDue);
    if (!p.ok) return p;
    data.nextReviewDue = p.d === undefined ? undefined : p.d;
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
