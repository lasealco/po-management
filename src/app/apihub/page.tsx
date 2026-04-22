import Link from "next/link";

import { toApiHubConnectorDto } from "@/lib/apihub/connector-dto";
import { listApiHubConnectorsWithRecentAudit } from "@/lib/apihub/connectors-repo";
import type { ApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import { toApiHubIngestionRunDto } from "@/lib/apihub/ingestion-run-dto";
import type { ApiHubApplyConflictListItemDto } from "@/lib/apihub/ingestion-apply-conflict-dto";
import { listApiHubApplyConflicts } from "@/lib/apihub/ingestion-apply-conflicts-repo";
import type { ApiHubIngestionAlertsSummaryDto } from "@/lib/apihub/ingestion-alerts-dto";
import { getApiHubIngestionAlertsSummary } from "@/lib/apihub/ingestion-alerts-summary-repo";
import { getApiHubIngestionRunOpsSummary, listApiHubIngestionRuns } from "@/lib/apihub/ingestion-runs-repo";
import type { ApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { toApiHubMappingAnalysisJobDto } from "@/lib/apihub/mapping-analysis-job-dto";
import { listApiHubMappingAnalysisJobs } from "@/lib/apihub/mapping-analysis-jobs-repo";
import type { ApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { toApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";
import { listApiHubMappingTemplates } from "@/lib/apihub/mapping-templates-repo";
import { listApiHubStagingBatches } from "@/lib/apihub/staging-batches-repo";
import type { ApiHubStagingBatchListItemDto } from "@/lib/apihub/staging-batch-dto";
import { toApiHubStagingBatchListItemDto } from "@/lib/apihub/staging-batch-dto";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ApplyConflictsPanel } from "./apply-conflicts-panel";
import { ConnectorsSection } from "./connectors-section";
import { IngestionAlertsPanel } from "./ingestion-alerts-panel";
import { DemoSyncShowcase } from "./demo-sync-showcase";
import { IngestionOpsPanel, type IngestionOpsSummaryPayload } from "./ingestion-ops-panel";
import { MappingAnalysisJobsPanel } from "./mapping-analysis-jobs-panel";
import { MappingPreviewExportPanel } from "./mapping-preview-export-panel";
import { MappingTemplatesSection } from "./mapping-templates-section";
import { StagingBatchesPanel } from "./staging-batches-panel";

export const dynamic = "force-dynamic";

const GITHUB_DOCS_APIHUB_TREE =
  "https://github.com/lasealco/po-management/tree/main/docs/apihub";
const GITHUB_SPEC_BLOB =
  "https://github.com/lasealco/po-management/blob/main/docs/apihub/integrations-ai-assisted-ingestion.md";

const STEP_PLACEHOLDERS = [
  {
    n: 1,
    title: "Intent",
    body: "Pick scenario and target (for example, new shipments from a partner file or API shape).",
    badge: "Placeholder",
  },
  {
    n: 2,
    title: "Uploads + optional docs",
    body: "Bring sample files, example API JSON, and optional reference documents — not as a secret channel.",
    badge: "Placeholder",
  },
  {
    n: 3,
    title: "AI analysis job",
    body: "Async job proposes structured mappings under guardrails; operators stay in control.",
    badge: "P2 — async job",
  },
  {
    n: 4,
    title: "Mapping editor",
    body: "Confirm source paths or columns → canonical fields, transforms, and required vs optional rules.",
    badge: "Templates + diff",
  },
  {
    n: 5,
    title: "Validate + real UI preview",
    body: "Dry-run against staging and open real app surfaces (read-only or flagged preview) where possible.",
    badge: "Preview + export",
  },
] as const;

export default async function ApihubHomePage() {
  const access = await getViewerGrantSet();
  const grantSet = access?.grantSet ?? new Set<string>();
  const canViewHub = Boolean(access?.user && access?.tenant && viewerHas(grantSet, "org.apihub", "view"));
  const canEditHub = canViewHub && viewerHas(grantSet, "org.apihub", "edit");

  const connectorRows =
    canViewHub && access?.tenant ? await listApiHubConnectorsWithRecentAudit(access.tenant.id, undefined, 3) : [];
  const initialConnectors = connectorRows.map(toApiHubConnectorDto);

  let ingestionInitialSummary: IngestionOpsSummaryPayload | null = null;
  let ingestionInitialRuns: ApiHubIngestionRunDto[] = [];
  let initialMappingTemplates: ApiHubMappingTemplateDto[] = [];
  let initialMappingAnalysisJobs: ApiHubMappingAnalysisJobDto[] = [];
  let initialStagingBatches: ApiHubStagingBatchListItemDto[] = [];
  let initialApplyConflicts: ApiHubApplyConflictListItemDto[] = [];
  let initialApplyConflictsNextCursor: string | null = null;
  let initialAlertsSummary: ApiHubIngestionAlertsSummaryDto | null = null;
  if (canViewHub && access?.tenant) {
    const [ops, listed, mappingRows, analysisJobRows, stagingBatchRows, applyConflicts, alertsSummary] =
      await Promise.all([
        getApiHubIngestionRunOpsSummary({ tenantId: access.tenant.id }),
        listApiHubIngestionRuns({
          tenantId: access.tenant.id,
          status: null,
          limit: 20,
          cursor: null,
          connectorId: null,
          triggerKind: null,
          attemptRange: null,
        }),
        listApiHubMappingTemplates(access.tenant.id, 50),
        listApiHubMappingAnalysisJobs({ tenantId: access.tenant.id, limit: 12 }),
        listApiHubStagingBatches({ tenantId: access.tenant.id, limit: 20 }),
        listApiHubApplyConflicts({ tenantId: access.tenant.id, limit: 20, cursor: null }),
        getApiHubIngestionAlertsSummary({ tenantId: access.tenant.id, limit: 12 }),
      ]);
    ingestionInitialSummary = {
      totals: ops.totals,
      windows: ops.windows,
      inFlight: ops.inFlight,
      totalRuns: ops.totalRuns,
      asOf: ops.asOf.toISOString(),
    };
    ingestionInitialRuns = listed.items.map(toApiHubIngestionRunDto);
    initialMappingTemplates = mappingRows.map(toApiHubMappingTemplateDto);
    initialMappingAnalysisJobs = analysisJobRows.map(toApiHubMappingAnalysisJobDto);
    initialStagingBatches = stagingBatchRows.map(toApiHubStagingBatchListItemDto);
    initialApplyConflicts = applyConflicts.items;
    initialApplyConflictsNextCursor = applyConflicts.nextCursor;
    initialAlertsSummary = alertsSummary;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">Integration and ingestion hub</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Single place for AI-assisted mapping proposals, human confirmation, and repeatable runs across file upload
              and server-to-server APIs. <span className="font-medium text-zinc-800">P2</span> ships async mapping
              analysis jobs (heuristic plus optional OpenAI JSON when API keys are configured), staging preview on the
              job, and persisted staging batches for API access. Access is org-scoped via{" "}
              <span className="font-mono text-xs text-zinc-700">org.apihub</span> view/edit.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <a
              href={GITHUB_DOCS_APIHUB_TREE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              View docs on GitHub
            </a>
            <a
              href={GITHUB_SPEC_BLOB}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              Open full spec (markdown)
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEP_PLACEHOLDERS.map((step) => (
            <div
              key={step.n}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step {step.n} / 5</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">{step.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">{step.body}</p>
              <p className="mt-3 text-[11px] font-medium text-zinc-500">{step.badge}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">Health:</span>{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-800">GET /api/apihub/health</code>{" "}
          returns <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">ok</code>,{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">service</code>, and{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">phase</code> (no auth, no secrets).{" "}
          <Link href="/api/apihub/health" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Try it
          </Link>
          .
        </div>
      </section>

      <DemoSyncShowcase />
      <IngestionOpsPanel
        canView={canViewHub}
        initialSummary={ingestionInitialSummary}
        initialRuns={ingestionInitialRuns}
      />
      <IngestionAlertsPanel canView={canViewHub} initialSummary={initialAlertsSummary} />
      <ApplyConflictsPanel
        canView={canViewHub}
        initialItems={initialApplyConflicts}
        initialNextCursor={initialApplyConflictsNextCursor}
      />
      <MappingAnalysisJobsPanel
        initialJobs={initialMappingAnalysisJobs}
        canView={canViewHub}
        canEdit={canEditHub}
      />
      <StagingBatchesPanel initialBatches={initialStagingBatches} canView={canViewHub} />
      <MappingTemplatesSection initialTemplates={initialMappingTemplates} canManage={canEditHub} />
      <MappingPreviewExportPanel canUse={canEditHub} />
      <ConnectorsSection initialConnectors={initialConnectors} canCreate={canEditHub} />
    </main>
  );
}
