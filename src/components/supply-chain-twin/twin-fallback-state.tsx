import type { ReactNode } from "react";

type TwinFallbackTone = "loading" | "empty" | "error" | "warning";

const TONE_CLASSNAME: Record<TwinFallbackTone, string> = {
  loading: "border-zinc-200 bg-zinc-50 text-zinc-700",
  empty: "border-zinc-300 bg-zinc-50/80 text-zinc-700",
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
};

type TwinFallbackStateProps = {
  title: string;
  description?: string;
  tone?: TwinFallbackTone;
  centered?: boolean;
  actions?: ReactNode;
  className?: string;
};

export function TwinFallbackState({
  title,
  description,
  tone = "empty",
  centered = false,
  actions,
  className = "",
}: TwinFallbackStateProps) {
  const alignment = centered ? "text-center" : "";
  const actionAlignment = centered ? "justify-center" : "";
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${TONE_CLASSNAME[tone]} ${alignment} ${className}`.trim()}>
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1">{description}</p> : null}
      {actions ? <div className={`mt-3 flex flex-wrap items-center gap-2 ${actionAlignment}`.trim()}>{actions}</div> : null}
    </div>
  );
}
