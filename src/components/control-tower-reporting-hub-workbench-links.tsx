import Link from "next/link";

import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";

const DEFAULT_WORKBENCH_HREF = "/control-tower/workbench";

const textLinkClass = "font-medium text-sky-800 hover:underline";

const buttonLinkClass: Record<"sm" | "md", string> = {
  sm: "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50",
  md: "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50",
};

/** Inline “Reporting hub” (CT focus) + optional “Workbench” link used across Control Tower and product trace headers. */
export function ControlTowerReportingHubWorkbenchLinks({
  className = "mb-3 flex flex-wrap gap-4 text-sm",
  includeWorkbench = true,
  variant = "text",
  buttonSize = "md",
  reportingLabel = "Reporting hub",
  workbenchLabel = "Workbench",
  workbenchHref = DEFAULT_WORKBENCH_HREF,
  noWrapper = false,
}: {
  className?: string;
  /** When false, only the Reporting hub link is rendered (e.g. Shipment 360 next to a workbench back-link). */
  includeWorkbench?: boolean;
  /** `button`: bordered control for toolbars; `text`: sky underlined row (default). */
  variant?: "text" | "button";
  /** When `variant` is `button`: `sm` matches My dashboard; `md` matches workbench header actions. */
  buttonSize?: "sm" | "md";
  /** Visible label for the reporting deep link (e.g. “← All reporting modules”, “Reporting hub — Control Tower”). */
  reportingLabel?: string;
  /** Visible label for the workbench link when `includeWorkbench`. */
  workbenchLabel?: string;
  /** Overrides default `/control-tower/workbench` (e.g. `?productTrace=…` from product trace). */
  workbenchHref?: string;
  /**
   * When true with `variant="text"` and `includeWorkbench`, render a fragment so links participate in a parent
   * flex `gap-*` (e.g. digest footer). `className` is ignored in that case.
   */
  noWrapper?: boolean;
}) {
  const btn = buttonLinkClass[buttonSize];
  const wb = workbenchHref;

  if (variant === "button") {
    const reporting = (
      <Link href={REPORTING_HUB_CONTROL_TOWER_HREF} className={btn}>
        {reportingLabel}
      </Link>
    );
    if (!includeWorkbench) {
      return reporting;
    }
    return (
      <>
        {reporting}
        <Link href={wb} className={btn}>
          {workbenchLabel}
        </Link>
      </>
    );
  }

  if (!includeWorkbench) {
    return (
      <Link href={REPORTING_HUB_CONTROL_TOWER_HREF} className={textLinkClass}>
        {reportingLabel}
      </Link>
    );
  }

  const pair = (
    <>
      <Link href={REPORTING_HUB_CONTROL_TOWER_HREF} className={textLinkClass}>
        {reportingLabel}
      </Link>
      <Link href={wb} className={textLinkClass}>
        {workbenchLabel}
      </Link>
    </>
  );

  if (noWrapper) {
    return pair;
  }

  return <div className={className}>{pair}</div>;
}
