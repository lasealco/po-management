"use client";

import type { SupplierComplianceReviewRow } from "@/components/supplier-compliance-reviews-section";
import type { SupplierDocumentRow } from "@/components/supplier-documents-section";
import { complianceReviewDueState } from "@/lib/srm/compliance-review-due";
import { summarizeComplianceDocumentSignals } from "@/lib/srm/supplier-compliance-document-signals";

function outcomeLabel(outcome: SupplierComplianceReviewRow["outcome"]): string {
  if (outcome === "satisfactory") return "Satisfactory";
  if (outcome === "action_required") return "Action required";
  if (outcome === "failed") return "Failed";
  return outcome;
}

export function SupplierComplianceDocumentSignals({
  documents,
  complianceReviews,
  isSrmShell,
  onOpenDocumentsTab,
}: {
  documents: SupplierDocumentRow[];
  complianceReviews: SupplierComplianceReviewRow[];
  isSrmShell: boolean;
  onOpenDocumentsTab: () => void;
}) {
  const summary = summarizeComplianceDocumentSignals(documents);
  const issues =
    summary.expired + summary.expiresSoon + summary.missingExpiryControlled;

  const hasAnyRows = documents.length > 0;
  const latestReview = complianceReviews[0] ?? null;
  const reviewDue = latestReview
    ? complianceReviewDueState(latestReview.nextReviewDue)
    : null;

  function goToDocuments() {
    if (isSrmShell) {
      onOpenDocumentsTab();
      return;
    }
    document.getElementById("supplier-documents-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50/90 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">Document control (readiness)</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Summarizes registered evidence from the Documents tab: expiry posture and missing expiry on
        insurance, license, and certificate rows. Archived rows are excluded. Not a full policy
        engine—buyer judgment still applies.
      </p>
      {latestReview ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800">
          <p className="font-semibold text-zinc-900">Latest periodic review</p>
          <p className="mt-1">
            <span className="font-medium">{outcomeLabel(latestReview.outcome)}</span>
            {" · "}
            {new Date(latestReview.reviewedAt).toLocaleDateString()}
            {latestReview.nextReviewDue ? (
              <>
                {" · Next due "}
                {new Date(latestReview.nextReviewDue).toLocaleDateString()}
              </>
            ) : null}
          </p>
          {reviewDue ? (
            <p
              className={`mt-1 font-medium ${
                reviewDue === "overdue" ? "text-rose-800" : "text-amber-900"
              }`}
            >
              {reviewDue === "overdue"
                ? "Next review date has passed — log an update in Compliance reviews below."
                : "Next review due within 14 days."}
            </p>
          ) : null}
          <p className="mt-1 line-clamp-2 text-zinc-600">{latestReview.summary}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-600">
          No compliance reviews recorded yet — add one in the section below after your document posture
          is in shape.
        </p>
      )}
      {!hasAnyRows ? (
        <p className="mt-3 text-sm text-zinc-600">
          No document records yet. Register policies and certificates under{" "}
          <strong className="font-medium text-zinc-800">Documents</strong>.
        </p>
      ) : issues === 0 ? (
        <p className="mt-3 text-sm text-emerald-900">
          No expiry gaps flagged for the current rules ({summary.activeTotal} active document
          {summary.activeTotal === 1 ? "" : "s"}
          {summary.archivedTotal > 0
            ? ` · ${summary.archivedTotal} archived (not counted)`
            : ""}
          ).
        </p>
      ) : (
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-800">
          {summary.expired > 0 ? (
            <li>
              <span className="font-medium text-rose-800">{summary.expired}</span> expired
            </li>
          ) : null}
          {summary.expiresSoon > 0 ? (
            <li>
              <span className="font-medium text-amber-900">{summary.expiresSoon}</span> expiring within
              30 days
            </li>
          ) : null}
          {summary.missingExpiryControlled > 0 ? (
            <li>
              <span className="font-medium text-amber-900">{summary.missingExpiryControlled}</span>{" "}
              insurance / license / certificate without an expiry date
            </li>
          ) : null}
        </ul>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={goToDocuments}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          {isSrmShell ? "Open Documents tab" : "Jump to Documents"}
        </button>
      </div>
    </section>
  );
}
