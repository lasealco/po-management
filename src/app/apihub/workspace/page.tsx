import Link from "next/link";
import { Suspense } from "react";

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

import { ApplyConflictsPanel } from "../apply-conflicts-panel";
import { ConnectorsSection } from "../connectors-section";
import { IngestionAlertsPanel } from "../ingestion-alerts-panel";
import { DemoSyncShowcase } from "../demo-sync-showcase";
import { IngestionOpsPanel, type IngestionOpsSummaryPayload } from "../ingestion-ops-panel";
import { MappingAnalysisJobsPanel } from "../mapping-analysis-jobs-panel";
import { MappingPreviewExportPanel } from "../mapping-preview-export-panel";
import { MappingTemplatesSection } from "../mapping-templates-section";
import { StagingBatchesPanel } from "../staging-batches-panel";
import { WorkspaceTabbedLayout } from "../workspace-tabbed-layout";
import { normalizeWorkspaceTab, workspaceTabHref } from "../workspace-tabs";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

const GITHUB_DOCS_APIHUB_TREE =
  "https://github.com/lasealco/po-management/tree/main/docs/apihub";
const GITHUB_SPEC_BLOB =
  "https://github.com/lasealco/po-management/blob/main/docs/apihub/integrations-ai-assisted-ingestion.md";

const STEP_PLACEHOLDERS = [
  {
    n: 1,
    title: "Intent",
    body: "Pick scenario and target (for example, new shipments from a partner file or API shape).",
    badge: "Scoping",
  },
  {
    n: 2,
    title: "Uploads + optional docs",
    body: "Bring sample files, example API JSON, and optional reference documents — not as a secret channel.",
    badge: "Inputs",
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

export default async function ApihubWorkspacePage({ searchParams }: PageProps) {
  const sp = (await (searchParams ?? Promise.resolve({}))) as { tab?: string | string[] };
  const rawTab = typeof sp.tab === "string" ? sp.tab : Array.isArray(sp.tab) ? sp.tab[0] : undefined;
  const initialTab = normalizeWorkspaceTab(rawTab);

  const access = await getViewerGrantSet();
  const grantSet = access?.grantSet ?? new Set<string>();
  const canViewHub = Boolean(access?.user && access?.tenant && viewerHas(grantSet, "org.apihub", "view"));
  const canEditHub = canViewHub && viewerHas(grantSet, "org.apihub", "edit");
  const canApplyStagingSalesOrder = canEditHub && viewerHas(grantSet, "org.orders", "edit");
  const canApplyStagingPurchaseOrder = canEditHub && viewerHas(grantSet, "org.orders", "edit");
  const canApplyStagingCtAudit = canEditHub && viewerHas(grantSet, "org.controltower", "edit");

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
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" aria-hidden />}
      >
        <WorkspaceTabbedLayout initialTabId={initialTab}>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900">Operator workspace</h2>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                    Manual console for ingestion runs, mapping jobs, staging, and connectors. New to the hub? Start at{" "}
                    <Link href="/apihub" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                      Guided import
                    </Link>{" "}
                    on the home page. <span className="font-medium text-zinc-800">P2</span> ships async mapping analysis
                    jobs, staging preview, and persisted batches. Access is org-scoped via{" "}
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
            </div>

            <div className="rounded-xl border border-zinc-200 bg-sky-50/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Default hub entry</p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">Guided import (assistant)</p>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                Purpose-first upload, keyword check, mapping review, and optional chat — the default experience at{" "}
                <span className="font-mono text-xs">/apihub</span>.
              </p>
              <Link
                href="/apihub"
                className="mt-4 inline-flex rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
              >
                Open guided import home
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">Health:</span>{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                GET /api/apihub/health
              </code>{" "}
              returns <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">ok</code>,{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">service</code>, and{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">phase</code> (no auth, no secrets).{" "}
              <Link href="/api/apihub/health" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                Try it
              </Link>
              .
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 text-sm text-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operator completion path</p>
              <p className="mt-2 text-sm text-zinc-600">
                Connector → run →{" "}
                <Link
                  href={workspaceTabHref("mapping-analysis-jobs")}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  mapping job
                </Link>{" "}
                →{" "}
                <Link
                  href={workspaceTabHref("mapping-preview-export")}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  preview
                </Link>{" "}
                →{" "}
                <Link
                  href={workspaceTabHref("staging-batches")}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  staging apply
                </Link>
                ; triage via{" "}
                <Link
                  href={workspaceTabHref("ingestion-alerts")}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  alerts
                </Link>{" "}
                and{" "}
                <Link
                  href={workspaceTabHref("apply-conflicts")}
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  apply conflicts
                </Link>
                . Limits and runbooks:{" "}
                <a
                  href={`${GITHUB_DOCS_APIHUB_TREE}/product-completion-v1.md`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  product-completion-v1.md
                </a>
                .
              </p>
            </div>
          </div>

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
          <StagingBatchesPanel
            initialBatches={initialStagingBatches}
            canView={canViewHub}
            canEdit={canEditHub}
            canApplySalesOrder={canApplyStagingSalesOrder}
            canApplyPurchaseOrder={canApplyStagingPurchaseOrder}
            canApplyCtAudit={canApplyStagingCtAudit}
          />
          <MappingTemplatesSection initialTemplates={initialMappingTemplates} canManage={canEditHub} />
          <MappingPreviewExportPanel canUse={canEditHub} />
          <ConnectorsSection initialConnectors={initialConnectors} canCreate={canEditHub} />
        </WorkspaceTabbedLayout>
      </Suspense>
    </main>
  );
}
