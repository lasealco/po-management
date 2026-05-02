"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { listAdvancedProgramConfigs } from "@/lib/assistant/advanced-programs";
import { normalizeAssistantUrlMode } from "@/lib/assistant/sales-operations-assistant-modes";
import {
  pathnameMatchesProgramTrackWorkspace,
  SPRINT_WORKSPACE_ENTRIES,
} from "@/lib/assistant/sprint-workspaces-catalog";
import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";

export function AssistantSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [emailPilot, setEmailPilot] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/assistant/inbox?count=1", { method: "GET" });
        if (!res.ok) {
          setInboxCount(0);
          return;
        }
        const d = (await res.json()) as { total?: number };
        setInboxCount(typeof d.total === "number" ? d.total : 0);
      } catch {
        setInboxCount(0);
      }
    })();
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/assistant/email-pilot");
        const d = (await res.json()) as { enabled?: boolean };
        setEmailPilot(d.enabled === true);
      } catch {
        setEmailPilot(false);
      }
    })();
  }, []);

  const isHome = pathname === "/assistant" || pathname === "/assistant/";
  const mode = normalizeAssistantUrlMode(searchParams.get("mode"));
  const hasModeQuery = searchParams.has("mode");

  const inbox = pathname.startsWith("/assistant/inbox");
  const commandCenter = pathname.startsWith("/assistant/command-center");
  const mail = pathname.startsWith("/assistant/mail");
  const workbench = pathname.startsWith("/assistant/workbench");
  const execution = pathname.startsWith("/assistant/execution");
  const autonomy = pathname.startsWith("/assistant/autonomy");
  const workEngine = pathname.startsWith("/assistant/work-engine");
  const evidenceQuality = pathname.startsWith("/assistant/evidence-quality");
  const governedAutomation = pathname.startsWith("/assistant/governed-automation");
  const admin = pathname.startsWith("/assistant/admin");
  const operatingSystem = pathname.startsWith("/assistant/operating-system");

  const advancedProgramCatalogCount = listAdvancedProgramConfigs().length;
  const programTrackActive =
    pathname.startsWith("/assistant/sprint-workspaces") || pathnameMatchesProgramTrackWorkspace(pathname);
  const onAdvancedProgramsRoute = pathname.startsWith("/assistant/advanced-programs");

  return (
    <ModuleSidebarAside className={className} aria-label="Assistant workspace navigation">
      <Link
        href="/assistant"
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        Assistant home
      </Link>

      <div className="space-y-4">
        <ModuleSidebarSection label="Assistant">
          <ModuleSidebarLink href="/assistant" active={isHome && !hasModeQuery} title="Start without a preset mode">
            New request
          </ModuleSidebarLink>
          <ModuleSidebarLink
            href="/assistant?mode=sales-order"
            active={isHome && hasModeQuery && mode === "sales-order"}
            title="Create sales order draft"
          >
            Sales order draft
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant?mode=stock" active={isHome && mode === "stock"} title="Check stock">
            Stock check
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant?mode=trace" active={isHome && mode === "trace"} title="Trace product movement">
            Product trace
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant?mode=drafts" active={isHome && mode === "drafts"} title="Review drafts">
            Review drafts
          </ModuleSidebarLink>
        </ModuleSidebarSection>

        <ModuleSidebarSection label="Workspace">
          <ModuleSidebarLink href="/assistant" active={isHome} title="Sales & operations assistant">
            Chat
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/inbox" active={inbox} title="Open items">
            <span className="inline-flex items-center gap-1">
              Inbox
              {inboxCount != null && inboxCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-semibold text-zinc-800">
                  {inboxCount > 99 ? "99+" : inboxCount}
                </span>
              ) : null}
            </span>
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/command-center" active={commandCenter} title="Cross-workspace command center">
            Command center
          </ModuleSidebarLink>
          {emailPilot ? (
            <ModuleSidebarLink href="/assistant/mail" active={mail} title="Email pilot">
              Mail
            </ModuleSidebarLink>
          ) : null}
          <ModuleSidebarLink href="/assistant/workbench" active={workbench} title="Copilot workbench">
            Workbench
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/execution" active={execution} title="Execution workbench">
            Execution
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/autonomy" active={autonomy} title="Autonomy workbench">
            Autonomy
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/work-engine" active={workEngine} title="Assistant work engine">
            Work engine
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/evidence-quality" active={evidenceQuality} title="Evidence & quality">
            Evidence quality
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/governed-automation" active={governedAutomation} title="Governed automation">
            Governed automation
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/admin" active={admin} title="Admin console">
            Admin
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/operating-system" active={operatingSystem} title="AI operating system">
            Operating system
          </ModuleSidebarLink>
        </ModuleSidebarSection>

        <ModuleSidebarSection label="Operations">
          <ModuleSidebarLink href="/assistant/order-orchestration" active={pathname.startsWith("/assistant/order-orchestration")}>
            Order orchestration
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/warehouse-capacity" active={pathname.startsWith("/assistant/warehouse-capacity")}>
            Warehouse capacity
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/exception-center" active={pathname.startsWith("/assistant/exception-center")}>
            Exception center
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/customer-intelligence" active={pathname.startsWith("/assistant/customer-intelligence")}>
            Customer intelligence
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/finance-control" active={pathname.startsWith("/assistant/finance-control")}>
            Finance control
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/risk-war-room" active={pathname.startsWith("/assistant/risk-war-room")}>
            Risk war room
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/master-data-quality" active={pathname.startsWith("/assistant/master-data-quality")}>
            Master data
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/planning-bridge" active={pathname.startsWith("/assistant/planning-bridge")}>
            Planning
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/contract-compliance" active={pathname.startsWith("/assistant/contract-compliance")}>
            Contracts
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/sustainability" active={pathname.startsWith("/assistant/sustainability")}>
            Sustainability
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/partner-ecosystem" active={pathname.startsWith("/assistant/partner-ecosystem")}>
            Partners
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/frontline" active={pathname.startsWith("/assistant/frontline")}>
            Frontline
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/meeting-intelligence" active={pathname.startsWith("/assistant/meeting-intelligence")}>
            Meetings
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/observability" active={pathname.startsWith("/assistant/observability")}>
            Observability
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/governance" active={pathname.startsWith("/assistant/governance")}>
            Governance
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/rollout-factory" active={pathname.startsWith("/assistant/rollout-factory")}>
            Rollout
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/value-realization" active={pathname.startsWith("/assistant/value-realization")}>
            Value
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/autonomous-loop" active={pathname.startsWith("/assistant/autonomous-loop")}>
            Loop
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/network-design" active={pathname.startsWith("/assistant/network-design")}>
            Network
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/simulation-studio" active={pathname.startsWith("/assistant/simulation-studio")}>
            Simulation
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/continuous-planning" active={pathname.startsWith("/assistant/continuous-planning")}>
            Plan control
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/revenue-operations" active={pathname.startsWith("/assistant/revenue-operations")}>
            Revenue ops
          </ModuleSidebarLink>
        </ModuleSidebarSection>

        <ModuleSidebarSection label="Programs">
          <ModuleSidebarLink href="/assistant/sprint-workspaces" active={programTrackActive} title="Sprint 1–25 program workspaces">
            Browse program track ({SPRINT_WORKSPACE_ENTRIES.length})
          </ModuleSidebarLink>
          <ModuleSidebarLink href="/assistant/advanced-programs" active={onAdvancedProgramsRoute} title="AMP review packets">
            Advanced catalog ({advancedProgramCatalogCount})
          </ModuleSidebarLink>
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
