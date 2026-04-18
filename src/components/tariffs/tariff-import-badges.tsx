import { parseStatusLabel, reviewStatusLabel } from "@/lib/tariff/import-batch-statuses";

function toneForParse(s: string): string {
  if (s === "PARSED_OK") return "bg-emerald-100 text-emerald-900";
  if (s === "PARSED_PARTIAL") return "bg-amber-100 text-amber-900";
  if (s === "PARSED_FAILED") return "bg-red-100 text-red-900";
  if (s === "PARSING" || s === "QUEUED") return "bg-sky-100 text-sky-900";
  if (s === "UPLOADED") return "bg-zinc-100 text-zinc-800";
  return "bg-zinc-100 text-zinc-700";
}

function toneForReview(s: string): string {
  if (s === "APPLIED") return "bg-emerald-100 text-emerald-900";
  if (s === "READY_TO_APPLY") return "bg-indigo-100 text-indigo-900";
  if (s === "IN_REVIEW") return "bg-amber-100 text-amber-900";
  if (s === "REJECTED") return "bg-red-100 text-red-900";
  return "bg-zinc-100 text-zinc-700";
}

export function TariffImportParseBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${toneForParse(status)}`}>
      {parseStatusLabel(status)}
    </span>
  );
}

export function TariffImportReviewBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${toneForReview(status)}`}>
      {reviewStatusLabel(status)}
    </span>
  );
}
