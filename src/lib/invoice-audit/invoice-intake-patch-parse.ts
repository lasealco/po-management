export type ParsedInvoiceIntakePatch = {
  hasReview: boolean;
  reviewDecision: "APPROVED" | "OVERRIDDEN" | null;
  reviewNote: string | null;
  hasAccounting: boolean;
  approvedForAccounting: boolean | null;
  accountingApprovalNote: string | null;
  hasRawSourceNotes: boolean;
  rawSourceNotes: string | null;
};

/**
 * Validates `PATCH /api/invoice-audit/intakes/:id` JSON before any database writes
 * (avoids saving finance review then failing on bad ops-notes payload).
 */
export function parseInvoiceIntakePatchBody(
  body: unknown,
): { ok: true; value: ParsedInvoiceIntakePatch } | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Expected JSON object." };
  }
  const o = body as Record<string, unknown>;

  const hasReview =
    typeof o.reviewDecision === "string" && o.reviewDecision.trim().length > 0;
  const hasAccountingKey = Object.prototype.hasOwnProperty.call(o, "approvedForAccounting");
  const hasRawSourceNotes = Object.prototype.hasOwnProperty.call(o, "rawSourceNotes");

  if (hasAccountingKey && typeof o.approvedForAccounting !== "boolean") {
    return { ok: false, status: 400, error: "approvedForAccounting must be a boolean when provided." };
  }
  const hasAccounting = hasAccountingKey && typeof o.approvedForAccounting === "boolean";

  if (hasRawSourceNotes && o.rawSourceNotes !== null && typeof o.rawSourceNotes !== "string") {
    return { ok: false, status: 400, error: "rawSourceNotes must be a string or null." };
  }

  if (!hasReview && !hasAccounting && !hasRawSourceNotes) {
    return {
      ok: false,
      status: 400,
      error:
        "Provide reviewDecision (APPROVED|OVERRIDDEN), approvedForAccounting (boolean), and/or rawSourceNotes (string|null).",
    };
  }

  let reviewDecision: "APPROVED" | "OVERRIDDEN" | null = null;
  let reviewNote: string | null = null;
  if (hasReview) {
    const rd = String(o.reviewDecision).trim().toUpperCase();
    if (rd !== "APPROVED" && rd !== "OVERRIDDEN") {
      return { ok: false, status: 400, error: "reviewDecision must be APPROVED or OVERRIDDEN." };
    }
    reviewDecision = rd === "APPROVED" ? "APPROVED" : "OVERRIDDEN";
    reviewNote = typeof o.reviewNote === "string" ? o.reviewNote : null;
  }

  const accountingApprovalNote =
    typeof o.accountingApprovalNote === "string" ? o.accountingApprovalNote : null;

  const rawSourceNotes = hasRawSourceNotes
    ? o.rawSourceNotes === null
      ? null
      : String(o.rawSourceNotes as string)
    : null;

  return {
    ok: true,
    value: {
      hasReview,
      reviewDecision,
      reviewNote,
      hasAccounting,
      approvedForAccounting: hasAccounting ? (o.approvedForAccounting as boolean) : null,
      accountingApprovalNote,
      hasRawSourceNotes,
      rawSourceNotes,
    },
  };
}
