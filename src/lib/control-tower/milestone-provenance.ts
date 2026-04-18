/** UI labels for `CtTrackingMilestone.sourceType` (string column, not enum). */
export function ctTrackingMilestoneProvenancePill(sourceType: string | null | undefined): {
  label: string;
  title: string;
  className: string;
} {
  const t = (sourceType ?? "").trim().toUpperCase();
  if (t === "INTEGRATION") {
    return {
      label: "Integration",
      title: "From carrier/forwarder integration or inbound webhook (validated server-side).",
      className: "rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-950",
    };
  }
  if (t === "SIMULATED") {
    return {
      label: "Simulated",
      title: "Demo / synthetic timeline — not asserted as live carrier truth.",
      className: "rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-950",
    };
  }
  if (!t || t === "MANUAL") {
    return {
      label: "Manual",
      title: "Entered or edited by a user in Control Tower.",
      className: "rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-800",
    };
  }
  return {
    label: t.length > 14 ? `${t.slice(0, 14)}…` : t,
    title: `Source type: ${sourceType}`,
    className: "rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 font-medium text-violet-950",
  };
}

/** `ShipmentMilestone.source` enum values → readable copy. */
export function workflowMilestoneSourcePill(source: string | null | undefined): {
  label: string;
  title: string;
  className: string;
} {
  const t = (source ?? "").trim().toUpperCase();
  switch (t) {
    case "INTERNAL":
      return {
        label: "Internal",
        title: "Recorded by buyer/ops workflow inside the app.",
        className: "rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 font-medium text-sky-950",
      };
    case "SUPPLIER":
      return {
        label: "Supplier",
        title: "Supplier portal or supplier-originated milestone signal.",
        className: "rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 font-medium text-orange-950",
      };
    case "FORWARDER":
      return {
        label: "Forwarder",
        title: "Forwarder / booking party workflow.",
        className: "rounded border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-950",
      };
    case "SYSTEM":
      return {
        label: "System",
        title: "Automated system transition (e.g. booking state machine).",
        className: "rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-800",
      };
    default:
      return {
        label: t || "—",
        title: `Workflow milestone source: ${source ?? "unknown"}`,
        className: "rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-medium text-zinc-700",
      };
  }
}
