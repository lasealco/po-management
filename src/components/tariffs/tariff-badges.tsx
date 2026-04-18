const tones = {
  neutral: "bg-zinc-100 text-zinc-800 ring-zinc-200/80",
  amber: "bg-amber-50 text-amber-950 ring-amber-200/80",
  green: "bg-emerald-50 text-emerald-900 ring-emerald-200/80",
  red: "bg-red-50 text-red-900 ring-red-200/80",
  slate: "bg-slate-100 text-slate-800 ring-slate-200/80",
} as const;

export type TariffBadgeTone = keyof typeof tones;

export function TariffBadge({ label, tone = "neutral" }: { label: string; tone?: TariffBadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

export function tariffContractStatusTone(status: string): TariffBadgeTone {
  if (status === "APPROVED") return "green";
  if (status === "UNDER_REVIEW") return "amber";
  if (status === "EXPIRED" || status === "ARCHIVED" || status === "SUPERSEDED") return "slate";
  return "neutral";
}

export function tariffApprovalTone(status: string): TariffBadgeTone {
  if (status === "APPROVED") return "green";
  if (status === "REJECTED") return "red";
  if (status === "PENDING") return "amber";
  return "neutral";
}
