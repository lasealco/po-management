import Link from "next/link";

import { controlTowerWorkbenchDrillHref } from "@/lib/control-tower/workbench-drill-from-report";

export function WorkbenchDrillLink(props: {
  dimension: string;
  rowKey: string;
  rowLabel: string;
  /** When set, workbench shipment links open Shipment 360 on the Milestones tab. */
  ship360Tab?: "milestones";
  className?: string;
}) {
  const href = controlTowerWorkbenchDrillHref({
    dimension: props.dimension,
    rowKey: props.rowKey,
    rowLabel: props.rowLabel,
    ship360Tab: props.ship360Tab,
  });
  if (!href) return null;
  return (
    <Link
      href={href}
      className={
        props.className ??
        "inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100"
      }
    >
      Open in workbench →
    </Link>
  );
}
