import type { SupplierSrmAlertSeverity, SupplierSrmAlertStatus } from "@prisma/client";

const SEVERITIES: SupplierSrmAlertSeverity[] = ["info", "warning", "critical"];
const STATUSES: SupplierSrmAlertStatus[] = ["open", "resolved"];

function isSeverity(v: string): v is SupplierSrmAlertSeverity {
  return SEVERITIES.includes(v as SupplierSrmAlertSeverity);
}

function isStatus(v: string): v is SupplierSrmAlertStatus {
  return STATUSES.includes(v as SupplierSrmAlertStatus);
}

export type SrmAlertCreateData = {
  title: string;
  message: string;
  severity: SupplierSrmAlertSeverity;
};

export type ParseSrmAlertCreateResult =
  | { ok: true; data: SrmAlertCreateData }
  | { ok: false; message: string };

export function parseSrmAlertCreateBody(o: Record<string, unknown>): ParseSrmAlertCreateResult {
  if (typeof o.title !== "string" || !o.title.trim()) {
    return { ok: false, message: "title is required." };
  }
  if (typeof o.message !== "string" || !o.message.trim()) {
    return { ok: false, message: "message is required." };
  }
  let severity: SupplierSrmAlertSeverity = "warning";
  if (o.severity !== undefined) {
    if (typeof o.severity !== "string" || !isSeverity(o.severity)) {
      return { ok: false, message: "severity must be info, warning, or critical." };
    }
    severity = o.severity;
  }
  return {
    ok: true,
    data: {
      title: o.title.trim().slice(0, 256),
      message: o.message.trim().slice(0, 8000),
      severity,
    },
  };
}

export type SrmAlertPatchData = {
  title?: string;
  message?: string;
  severity?: SupplierSrmAlertSeverity;
  status?: SupplierSrmAlertStatus;
  resolvedAt?: Date | null;
};

export type ParseSrmAlertPatchResult =
  | { ok: true; data: SrmAlertPatchData }
  | { ok: false; message: string };

export function parseSrmAlertPatchBody(o: Record<string, unknown>): ParseSrmAlertPatchResult {
  const data: SrmAlertPatchData = {};
  if ("title" in o) {
    if (typeof o.title !== "string" || !o.title.trim()) {
      return { ok: false, message: "title cannot be empty." };
    }
    data.title = o.title.trim().slice(0, 256);
  }
  if ("message" in o) {
    if (typeof o.message !== "string" || !o.message.trim()) {
      return { ok: false, message: "message cannot be empty." };
    }
    data.message = o.message.trim().slice(0, 8000);
  }
  if ("severity" in o) {
    if (typeof o.severity !== "string" || !isSeverity(o.severity)) {
      return { ok: false, message: "severity must be info, warning, or critical." };
    }
    data.severity = o.severity;
  }
  if ("status" in o) {
    if (typeof o.status !== "string" || !isStatus(o.status)) {
      return { ok: false, message: "status must be open or resolved." };
    }
    data.status = o.status;
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, message: "No fields to update." };
  }
  return { ok: true, data };
}
