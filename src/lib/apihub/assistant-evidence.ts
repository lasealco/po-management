export type ApiHubAssistantConnectorSignal = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  authMode: string;
  authState: string;
  healthSummary: string | null;
  updatedAt: Date | string;
};

export type ApiHubAssistantStagingSignal = {
  id: string;
  title: string | null;
  status: string;
  rowCount: number;
  appliedAt: Date | string | null;
  applySummary?: unknown;
  updatedAt: Date | string;
};

export function redactApiHubAssistantValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactApiHubAssistantValue);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/secret|token|password|credential|authConfigRef/i.test(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = redactApiHubAssistantValue(raw);
    }
  }
  return out;
}

export function buildConnectorEvidence(connector: ApiHubAssistantConnectorSignal) {
  const severity = connector.status === "active" && connector.authState === "configured" ? "INFO" : "WARN";
  return {
    sourceType: "connector",
    sourceId: connector.id,
    title: `Connector ${connector.name}`,
    summary: [
      `Source kind: ${connector.sourceKind}.`,
      `Status: ${connector.status}; auth state: ${connector.authState}; auth mode: ${connector.authMode}.`,
      connector.healthSummary ? `Health: ${connector.healthSummary}` : "No health summary yet.",
    ].join(" "),
    severity,
    href: `/apihub/workspace?tab=connectors`,
    evidence: redactApiHubAssistantValue({
      id: connector.id,
      name: connector.name,
      sourceKind: connector.sourceKind,
      status: connector.status,
      authMode: connector.authMode,
      authState: connector.authState,
      healthSummary: connector.healthSummary,
      updatedAt: new Date(connector.updatedAt).toISOString(),
    }),
  };
}

export function buildStagingEvidence(batch: ApiHubAssistantStagingSignal) {
  const hasIssues = JSON.stringify(batch.applySummary ?? "").toLowerCase().includes("error");
  return {
    sourceType: "staging_batch",
    sourceId: batch.id,
    title: `Staging batch ${batch.title ?? batch.id}`,
    summary: `${batch.rowCount} mapped row${batch.rowCount === 1 ? "" : "s"} are ${batch.status}; ${
      batch.appliedAt ? "batch has been applied" : "batch is not applied"
    }.`,
    severity: hasIssues || batch.status === "open" ? "WARN" : "INFO",
    href: `/apihub/workspace?tab=staging-batches`,
    evidence: redactApiHubAssistantValue({
      id: batch.id,
      title: batch.title,
      status: batch.status,
      rowCount: batch.rowCount,
      appliedAt: batch.appliedAt ? new Date(batch.appliedAt).toISOString() : null,
      applySummary: batch.applySummary ?? null,
      updatedAt: new Date(batch.updatedAt).toISOString(),
    }),
  };
}

export function buildApplyConflictExplanation(conflict: {
  id: string;
  ingestionRunId: string;
  resultCode: string;
  httpStatus: number;
  dryRun: boolean;
  connectorId: string | null;
}) {
  return [
    `Apply conflict ${conflict.id} on ingestion run ${conflict.ingestionRunId}.`,
    `Result ${conflict.resultCode} (HTTP ${conflict.httpStatus})${conflict.dryRun ? " during dry-run" : ""}.`,
    conflict.connectorId ? `Connector ${conflict.connectorId} should be reviewed.` : "No connector id was attached.",
    "Assistant can queue review work, but cannot apply or mutate downstream records silently.",
  ].join(" ");
}
