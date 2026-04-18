"use client";

import type { SupplierDocumentCategory } from "@prisma/client";

import type { SupplierComplianceReviewRow } from "@/components/supplier-compliance-reviews-section";
import type { SupplierDocumentRow } from "@/components/supplier-documents-section";
import { complianceReviewDueState } from "@/lib/srm/compliance-review-due";
import {
  complianceDocumentReadinessScore,
  listComplianceDocumentFindings,
  summarizeComplianceDocumentSignals,
} from "@/lib/srm/supplier-compliance-document-signals";
import {
  DOCUMENT_EXPIRY_CRITICAL_DAYS,
  DOCUMENT_EXPIRY_SOON_DAYS,
} from "@/lib/srm/supplier-document-expiry";

function outcomeLabel(outcome: SupplierComplianceReviewRow["outcome"]): string {
  if (outcome === "satisfactory") return "Satisfactory";
  if (outcome === "action_required") return "Action required";
  if (outcome === "failed") return "Failed";
  return outcome;
}

function kindLabel(kind: string): string {
  if (kind === "expired") return "Expired";
  if (kind === "expires_critical") return `Critical (≤${DOCUMENT_EXPIRY_CRITICAL_DAYS}d)`;
  if (kind === "expires_soon") return `Soon (≤${DOCUMENT_EXPIRY_SOON_DAYS}d)`;
  if (kind === "missing_expiry") return "Missing expiry (controlled)";
  if (kind === "missing_document") return "Missing document type";
  return kind;
}

function kindColor(kind: string): string {
  if (kind === "expired") return "text-rose-800";
  if (kind === "expires_critical") return "text-orange-900";
  if (kind === "expires_soon") return "text-amber-900";
  if (kind === "missing_expiry") return "text-amber-800";
  return "text-zinc-800";
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
  onOpenDocumentsTab: (focusCategory?: SupplierDocumentCategory) => void;
}) {
  const summary = summarizeComplianceDocumentSignals(documents);
  const issues =
    summary.expired +
    summary.expiresCritical +
    summary.expiresSoon +
    summary.missingExpiryControlled +
    summary.missingControlledSlots;
  const findings = listComplianceDocumentFindings(documents);
  const readinessScore = complianceDocumentReadinessScore(summary);

  const hasAnyRows = documents.length > 0;
  const latestReview = complianceReviews[0] ?? null;
  const reviewDue = latestReview
    ? complianceReviewDueState(latestReview.nextReviewDue)
    : null;

  function goToDocuments(focus?: SupplierDocumentCategory) {
    onOpenDocumentsTab(focus);
  }

  const readinessLabel =
    readinessScore >= 85 ? "Strong" : readinessScore >= 60 ? "Fair" : readinessScore >= 35 ? "Weak" : "At risk";

  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50/90 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">Document control (readiness)</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Expiry tiers: <strong className="font-medium">critical</strong> ≤{DOCUMENT_EXPIRY_CRITICAL_DAYS} days,{" "}
        <strong className="font-medium">soon</strong> ≤{DOCUMENT_EXPIRY_SOON_DAYS} days (then past = expired).
        Controlled categories (insurance, license, certificate) need either an active row on file with an expiry
        where required, or an explicit buyer decision elsewhere. Archived rows are excluded.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs">
        <span className="font-semibold text-zinc-900">Readiness score</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono tabular-nums text-zinc-900">
          {readinessScore}/100
        </span>
        <span className="text-zinc-600">· {readinessLabel}</span>
      </div>
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
          <strong className="font-medium text-zinc-800">Documents</strong>, or use the shortcuts below for
          each required type.
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
        <>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-800">
            {summary.expired > 0 ? (
              <li>
                <span className="font-medium text-rose-800">{summary.expired}</span> expired
              </li>
            ) : null}
            {summary.expiresCritical > 0 ? (
              <li>
                <span className="font-medium text-orange-900">{summary.expiresCritical}</span> in critical
                window (≤{DOCUMENT_EXPIRY_CRITICAL_DAYS} days)
              </li>
            ) : null}
            {summary.expiresSoon > 0 ? (
              <li>
                <span className="font-medium text-amber-900">{summary.expiresSoon}</span> expiring within{" "}
                {DOCUMENT_EXPIRY_SOON_DAYS} days (outside critical only)
              </li>
            ) : null}
            {summary.missingExpiryControlled > 0 ? (
              <li>
                <span className="font-medium text-amber-900">{summary.missingExpiryControlled}</span>{" "}
                insurance / license / certificate without an expiry date
              </li>
            ) : null}
            {summary.missingControlledSlots > 0 ? (
              <li>
                <span className="font-medium text-zinc-900">{summary.missingControlledSlots}</span> required
                document type{summary.missingControlledSlots === 1 ? "" : "s"} missing entirely
              </li>
            ) : null}
          </ul>
          <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Rows & gaps (Documents tab)
            </p>
            <ul className="mt-2 divide-y divide-zinc-100 text-xs text-zinc-800">
              {findings.map((f) => (
                <li key={`${f.id}-${f.kind}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900">{f.title}</p>
                    <p className={`mt-0.5 font-medium ${kindColor(f.kind)}`}>{kindLabel(f.kind)}</p>
                    {f.detail ? <p className="mt-1 text-[11px] text-zinc-600">{f.detail}</p> : null}
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {f.category.replace(/_/g, " ")}
                    </p>
                  </div>
                  {f.kind === "missing_document" ? (
                    <button
                      type="button"
                      onClick={() => goToDocuments(f.category)}
                      className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-900 hover:bg-zinc-50"
                    >
                      Register {f.category}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {summary.missingControlledSlots > 0 && !hasAnyRows ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(["insurance", "license", "certificate"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => goToDocuments(cat)}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Start {cat} record
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => goToDocuments()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          {isSrmShell ? "Open Documents tab" : "Jump to Documents"}
        </button>
      </div>
    </section>
  );
}
