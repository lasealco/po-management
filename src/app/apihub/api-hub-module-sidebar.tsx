"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";

import {
  WORKSPACE_TAB_META,
  normalizeWorkspaceTab,
  workspaceTabHref,
  type WorkspaceTabId,
} from "./workspace-tabs";

const WORKSPACE_TAB_LABELS: Partial<Record<WorkspaceTabId, string>> = {
  overview: "Overview",
  "demo-sync": "Demo sync",
  "ingestion-ops": "Ingestion runs",
  "ingestion-alerts": "Alerts",
  "apply-conflicts": "Apply conflicts",
  "mapping-analysis-jobs": "Analysis jobs",
  "staging-batches": "Staging batches",
  "mapping-templates": "Mapping templates",
  "mapping-preview-export": "Preview export",
  connectors: "Connectors",
};

export function ApiHubModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const workspaceTab = normalizeWorkspaceTab(searchParams.get("tab") ?? undefined);

  const guidedActive =
    pathname === "/apihub" ||
    pathname === "/apihub/" ||
    pathname.startsWith("/apihub/import-assistant");
  const assistantActive = pathname === "/apihub/assistant" || pathname.startsWith("/apihub/assistant/");
  const onWorkspace = pathname === "/apihub/workspace" || pathname.startsWith("/apihub/workspace");

  function workspaceTabActive(id: WorkspaceTabId): boolean {
    return onWorkspace && workspaceTab === id;
  }

  return (
    <ModuleSidebarAside aria-label="API hub navigation" className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}>
      <Link href="/apihub" className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]">
        API hub home
      </Link>

      <div className="space-y-4">
        <ModuleSidebarSection label="Import & assistant">
          <ModuleSidebarLink href="/apihub" active={guidedActive} title="AI-assisted forwarder import">
            Guided import
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/apihub/assistant" active={assistantActive} title="Assistant evidence">
            Assistant evidence
          </ModuleSidebarLink>
        </ModuleSidebarSection>

        <ModuleSidebarSection label="Operator workspace">
          {WORKSPACE_TAB_META.map(({ id }) => {
            const href = workspaceTabHref(id);
            const label = WORKSPACE_TAB_LABELS[id] ?? id;
            return (
              <ModuleSidebarLink key={id} href={href} active={workspaceTabActive(id)} title={label}>
                {label}
              </ModuleSidebarLink>
            );
          })}
        </ModuleSidebarSection>

        <ModuleSidebarSection label="Platform">
          <ModuleSidebarLink href="/settings/demo" active={pathname.startsWith("/settings/demo")} title="Demo session">
            Demo session
          </ModuleSidebarLink>
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
