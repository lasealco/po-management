import type { SupplierQualificationStatus } from "@prisma/client";

const STATUSES: SupplierQualificationStatus[] = [
  "not_started",
  "in_progress",
  "qualified",
  "conditional",
  "disqualified",
];

function isQualificationStatus(v: string): v is SupplierQualificationStatus {
  return STATUSES.includes(v as SupplierQualificationStatus);
}

export type SupplierQualificationUpdateData = {
  qualificationStatus?: SupplierQualificationStatus;
  qualificationSummary?: string | null;
  qualificationLastReviewedAt?: Date | null;
};

export type ParseSupplierQualificationFieldsResult =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: SupplierQualificationUpdateData };

export function parseSupplierQualificationFields(
  o: Record<string, unknown>,
): ParseSupplierQualificationFieldsResult {
  const touched =
    "qualificationStatus" in o ||
    "qualificationSummary" in o ||
    "qualificationLastReviewedAt" in o;
  if (!touched) return { kind: "none" };

  const data: SupplierQualificationUpdateData = {};

  if ("qualificationStatus" in o) {
    const v = o.qualificationStatus;
    if (v === null || v === undefined) {
      return { kind: "error", message: "qualificationStatus cannot be null." };
    }
    if (typeof v !== "string" || !isQualificationStatus(v)) {
      return {
        kind: "error",
        message: "qualificationStatus must be not_started, in_progress, qualified, conditional, or disqualified.",
      };
    }
    data.qualificationStatus = v;
  }

  if ("qualificationSummary" in o) {
    const v = o.qualificationSummary;
    if (v === null) {
      data.qualificationSummary = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      data.qualificationSummary = t ? t.slice(0, 16000) : null;
    } else {
      return { kind: "error", message: "Invalid qualificationSummary." };
    }
  }

  if ("qualificationLastReviewedAt" in o) {
    const v = o.qualificationLastReviewedAt;
    if (v === null) {
      data.qualificationLastReviewedAt = null;
    } else if (typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return { kind: "error", message: "Invalid qualificationLastReviewedAt (expected ISO date)." };
      }
      data.qualificationLastReviewedAt = d;
    } else {
      return { kind: "error", message: "Invalid qualificationLastReviewedAt." };
    }
  }

  if (Object.keys(data).length === 0) {
    return { kind: "error", message: "No valid qualification fields to update." };
  }

  return { kind: "ok", data };
}
