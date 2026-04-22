"use client";

type Props = {
  /** Shown on the summary row (default: Advanced — raw JSON). */
  label?: string;
  /** Short hint under the summary (optional). */
  description?: string;
  value: unknown;
  /** Tailwind max-height on the pre (default max-h-64). */
  maxHeightClass?: string;
  /** Use dark pre styling (default true). */
  dark?: boolean;
};

/**
 * Consistent “summary first, raw JSON second” control for ApiHub operator surfaces.
 */
export function ApiHubAdvancedJsonDisclosure({
  label = "Advanced — raw JSON",
  description = "Full structured payload for debugging. Most operators can ignore this.",
  value,
  maxHeightClass = "max-h-64",
  dark = true,
}: Props) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 [&::-webkit-details-marker]:hidden">
        <span className="select-none">{label}</span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-0">
        {description ? <p className="pt-3 text-xs text-zinc-500">{description}</p> : null}
        <pre
          className={`mt-3 overflow-auto rounded-lg p-3 text-[11px] leading-relaxed ${
            dark
              ? "bg-zinc-950 text-zinc-100"
              : "border border-zinc-200 bg-zinc-50 text-zinc-800"
          } ${maxHeightClass}`}
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    </details>
  );
}
