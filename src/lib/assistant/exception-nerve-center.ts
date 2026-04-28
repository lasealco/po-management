export type ExceptionSignalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ExceptionSignal = {
  id: string;
  module: string;
  objectType: string;
  objectId: string;
  title: string;
  detail: string | null;
  severity: ExceptionSignalSeverity;
  status: string;
  href: string | null;
  customerLabel: string | null;
  ownerLabel: string | null;
  occurredAt: string;
  dedupeKey: string;
};

const SEVERITY_SCORE: Record<ExceptionSignalSeverity, number> = {
  LOW: 20,
  MEDIUM: 45,
  HIGH: 70,
  CRITICAL: 95,
};

export function normalizeExceptionSeverity(value: string | null | undefined): ExceptionSignalSeverity {
  const s = (value ?? "").trim().toUpperCase();
  if (s === "CRITICAL" || s === "ERROR" || s === "FAIL" || s === "FAILED" || s === "RED") return "CRITICAL";
  if (s === "HIGH" || s === "WARN" || s === "WARNING" || s === "AMBER" || s === "OVERLOADED") return "HIGH";
  if (s === "LOW" || s === "INFO" || s === "READY") return "LOW";
  return "MEDIUM";
}

export function computeIncidentSeverity(signals: ExceptionSignal[]) {
  if (signals.length === 0) return { severity: "LOW" as ExceptionSignalSeverity, score: 0 };
  const max = Math.max(...signals.map((signal) => SEVERITY_SCORE[signal.severity]));
  const modulePressure = Math.min(15, new Set(signals.map((signal) => signal.module)).size * 3);
  const objectPressure = Math.min(10, signals.length * 2);
  const score = Math.max(0, Math.min(100, Math.round(max + modulePressure + objectPressure)));
  const severity: ExceptionSignalSeverity = score >= 90 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return { severity, score };
}

export function findDuplicateIncidentGroups(signals: ExceptionSignal[]) {
  const groups = new Map<string, ExceptionSignal[]>();
  for (const signal of signals) {
    groups.set(signal.dedupeKey, [...(groups.get(signal.dedupeKey) ?? []), signal]);
  }
  return Array.from(groups.entries())
    .map(([dedupeKey, items]) => ({ dedupeKey, count: items.length, modules: Array.from(new Set(items.map((item) => item.module))).sort(), signals: items }))
    .filter((group) => group.count > 1 || group.modules.length > 1)
    .sort((a, b) => b.count - a.count || a.dedupeKey.localeCompare(b.dedupeKey));
}

function moduleSummary(signals: ExceptionSignal[]) {
  const counts = new Map<string, number>();
  for (const signal of signals) counts.set(signal.module, (counts.get(signal.module) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));
}

export function buildExceptionIncidentDraft(input: { title?: string | null; signals: ExceptionSignal[] }) {
  const signals = [...input.signals].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const topSignal = signals.toSorted((a, b) => SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity])[0] ?? null;
  const severity = computeIncidentSeverity(signals);
  const modules = moduleSummary(signals);
  const customers = Array.from(new Set(signals.map((signal) => signal.customerLabel).filter((label): label is string => Boolean(label)))).sort();
  const linkedObjects = signals.map((signal) => ({
    module: signal.module,
    objectType: signal.objectType,
    objectId: signal.objectId,
    title: signal.title,
    href: signal.href,
    severity: signal.severity,
  }));
  const incidentKey = topSignal?.dedupeKey ?? `manual:${signals.map((signal) => signal.id).sort().join("|") || "empty"}`;
  const title =
    input.title?.trim() ||
    (topSignal ? `${topSignal.title}${modules.length > 1 ? ` across ${modules.length} modules` : ""}` : "Manual exception incident");
  const customerImpact =
    customers.length > 0
      ? `${customers.length} customer/account label${customers.length === 1 ? "" : "s"} may be impacted: ${customers.slice(0, 5).join(", ")}.`
      : "Customer impact is not confirmed from current evidence.";
  const playbook = [
    { step: "Triage", owner: "Incident owner", status: "OPEN", instruction: "Validate duplicate signals, severity, and blast radius before assigning recovery work." },
    { step: "Contain", owner: "Domain owners", status: "OPEN", instruction: "Stop additional customer impact; do not mutate orders, stock, invoices, integrations, or shipments without approved actions." },
    { step: "Communicate", owner: "Customer / partner owner", status: "OPEN", instruction: "Review and edit customer-safe and partner-safe drafts before sending." },
    { step: "Recover", owner: "Operations", status: "OPEN", instruction: "Queue module-specific recovery actions and record decisions in the action queue." },
    { step: "Close", owner: "Incident owner", status: "OPEN", instruction: "Close only with root-cause notes, impacted objects, and follow-up owner." },
  ];
  const communicationDraft = {
    customer: [
      `We are actively managing an operational exception: ${title}.`,
      customerImpact,
      "We will share confirmed recovery timing after operations review. This message avoids internal cost, supplier, or invoice details.",
    ].join("\n\n"),
    internal: [
      `${severity.severity} incident ${title} has ${signals.length} linked signal${signals.length === 1 ? "" : "s"} across ${modules.length} module${modules.length === 1 ? "" : "s"}.`,
      `Top modules: ${modules.map((row) => `${row.module} (${row.count})`).join(", ") || "none"}.`,
      "Approve recovery actions in the queue before changing source records.",
    ].join("\n\n"),
  };

  return {
    title,
    incidentKey,
    severity: severity.severity,
    severityScore: severity.score,
    sourceSummary: {
      signalCount: signals.length,
      modules,
      duplicateGroups: findDuplicateIncidentGroups(signals),
    },
    linkedObjects,
    blastRadius: {
      modules: modules.map((row) => row.module),
      signalCount: signals.length,
      customerLabels: customers,
      highestSeverity: severity.severity,
      highestSeverityScore: severity.score,
    },
    timeline: signals.map((signal) => ({
      at: signal.occurredAt,
      module: signal.module,
      title: signal.title,
      status: signal.status,
      href: signal.href,
    })),
    playbook,
    communicationDraft,
    customerImpact,
  };
}

export function mergeIncidentDrafts(primary: ReturnType<typeof buildExceptionIncidentDraft>, secondary: ReturnType<typeof buildExceptionIncidentDraft>) {
  const linkedObjects = [...primary.linkedObjects, ...secondary.linkedObjects];
  const deduped = new Map<string, (typeof linkedObjects)[number]>();
  for (const object of linkedObjects) deduped.set(`${object.objectType}:${object.objectId}`, object);
  const modules = Array.from(new Set([...primary.blastRadius.modules, ...secondary.blastRadius.modules])).sort();
  const severity = computeIncidentSeverity(
    Array.from(deduped.values()).map((object, index) => ({
      id: `${object.objectType}:${object.objectId}`,
      module: object.module,
      objectType: object.objectType,
      objectId: object.objectId,
      title: object.title,
      detail: null,
      severity: object.severity,
      status: "LINKED",
      href: object.href,
      customerLabel: null,
      ownerLabel: null,
      occurredAt: primary.timeline[index]?.at ?? new Date(0).toISOString(),
      dedupeKey: primary.incidentKey,
    })),
  );
  return {
    ...primary,
    severity: severity.severity,
    severityScore: severity.score,
    linkedObjects: Array.from(deduped.values()),
    blastRadius: {
      ...primary.blastRadius,
      modules,
      signalCount: deduped.size,
      highestSeverity: severity.severity,
      highestSeverityScore: severity.score,
    },
    timeline: [...primary.timeline, ...secondary.timeline].sort((a, b) => String(a.at).localeCompare(String(b.at))),
    sourceSummary: {
      ...primary.sourceSummary,
      signalCount: deduped.size,
      modules: modules.map((module) => ({ module, count: Array.from(deduped.values()).filter((object) => object.module === module).length })),
    },
  };
}

export function buildCustomerSafeIncidentSummary(draft: ReturnType<typeof buildExceptionIncidentDraft>) {
  return [
    `${draft.title} is being managed as a ${draft.severity.toLowerCase()} operational incident.`,
    draft.customerImpact,
    "Recovery timing and next steps will be shared after human review; internal cost, supplier, and invoice details are withheld.",
  ].join(" ");
}
