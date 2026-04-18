import type { SupplierRiskSeverity, SupplierRiskStatus } from "@prisma/client";

const SEVERITIES: SupplierRiskSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: SupplierRiskStatus[] = ["open", "mitigating", "closed"];

function isSeverity(v: string): v is SupplierRiskSeverity {
  return SEVERITIES.includes(v as SupplierRiskSeverity);
}

function isStatus(v: string): v is SupplierRiskStatus {
  return STATUSES.includes(v as SupplierRiskStatus);
}

export type RiskRecordCreateData = {
  title: string;
  category: string;
  severity: SupplierRiskSeverity;
  details: string | null;
  identifiedAt: Date;
};

export type ParseRiskCreateResult =
  | { ok: true; data: RiskRecordCreateData }
  | { ok: false; message: string };

export function parseRiskRecordCreateBody(o: Record<string, unknown>): ParseRiskCreateResult {
  if (typeof o.title !== "string" || !o.title.trim()) {
    return { ok: false, message: "title is required." };
  }
  const title = o.title.trim().slice(0, 256);
  if (typeof o.category !== "string" || !o.category.trim()) {
    return { ok: false, message: "category is required." };
  }
  const category = o.category.trim().slice(0, 128);
  if (typeof o.severity !== "string" || !isSeverity(o.severity)) {
    return { ok: false, message: "severity must be low, medium, high, or critical." };
  }
  let details: string | null = null;
  if ("details" in o) {
    if (o.details === null) details = null;
    else if (typeof o.details === "string") {
      const t = o.details.trim();
      details = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid details." };
    }
  }
  let identifiedAt = new Date();
  if (o.identifiedAt !== undefined) {
    if (typeof o.identifiedAt !== "string") {
      return { ok: false, message: "Invalid identifiedAt." };
    }
    const d = new Date(o.identifiedAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, message: "Invalid identifiedAt (expected ISO date)." };
    }
    identifiedAt = d;
  }
  return { ok: true, data: { title, category, severity: o.severity, details, identifiedAt } };
}

export type RiskRecordPatchData = {
  severity?: SupplierRiskSeverity;
  status?: SupplierRiskStatus;
  details?: string | null;
  closedAt?: Date | null;
};

export type ParseRiskPatchResult =
  | { ok: true; data: RiskRecordPatchData }
  | { ok: false; message: string };

export function parseRiskRecordPatchBody(o: Record<string, unknown>): ParseRiskPatchResult {
  const data: RiskRecordPatchData = {};
  if ("severity" in o) {
    if (typeof o.severity !== "string" || !isSeverity(o.severity)) {
      return { ok: false, message: "severity must be low, medium, high, or critical." };
    }
    data.severity = o.severity;
  }
  if ("status" in o) {
    if (typeof o.status !== "string" || !isStatus(o.status)) {
      return { ok: false, message: "status must be open, mitigating, or closed." };
    }
    data.status = o.status;
  }
  if ("details" in o) {
    if (o.details === null) data.details = null;
    else if (typeof o.details === "string") {
      const t = o.details.trim();
      data.details = t ? t.slice(0, 8000) : null;
    } else {
      return { ok: false, message: "Invalid details." };
    }
  }
  if ("closedAt" in o) {
    if (o.closedAt === null) data.closedAt = null;
    else if (typeof o.closedAt === "string") {
      const d = new Date(o.closedAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, message: "Invalid closedAt (expected ISO date)." };
      }
      data.closedAt = d;
    } else {
      return { ok: false, message: "Invalid closedAt." };
    }
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
