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
import { appNavActiveClass, appNavInactiveClass } from "@/lib/subnav-active-class";

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="flex flex-col gap-0.5 text-sm">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  title,
  children,
}: {
  href: string;
  active: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} title={title} className={active ? appNavActiveClass : appNavInactiveClass}>
      {children}
    </Link>
  );
}

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
    <aside
      className={`rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${className ?? ""}`}
      aria-label="Assistant workspace navigation"
    >
      <Link
        href="/assistant"
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        Assistant home
      </Link>

      <div className="space-y-4">
        <SidebarGroup label="Assistant">
          <SidebarLink href="/assistant" active={isHome && !hasModeQuery} title="Start without a preset mode">
            New request
          </SidebarLink>
          <SidebarLink
            href="/assistant?mode=sales-order"
            active={isHome && hasModeQuery && mode === "sales-order"}
            title="Create sales order draft"
          >
            Sales order draft
          </SidebarLink>
          <SidebarLink href="/assistant?mode=stock" active={isHome && mode === "stock"} title="Check stock">
            Stock check
          </SidebarLink>
          <SidebarLink href="/assistant?mode=trace" active={isHome && mode === "trace"} title="Trace product movement">
            Product trace
          </SidebarLink>
          <SidebarLink href="/assistant?mode=drafts" active={isHome && mode === "drafts"} title="Review drafts">
            Review drafts
          </SidebarLink>
        </SidebarGroup>

        <SidebarGroup label="Workspace">
          <SidebarLink href="/assistant" active={isHome} title="Sales & operations assistant">
            Chat
          </SidebarLink>
          <SidebarLink href="/assistant/inbox" active={inbox} title="Open items">
            <span className="inline-flex items-center gap-1">
              Inbox
              {inboxCount != null && inboxCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-semibold text-zinc-800">
                  {inboxCount > 99 ? "99+" : inboxCount}
                </span>
              ) : null}
            </span>
          </SidebarLink>
          <SidebarLink href="/assistant/command-center" active={commandCenter} title="Cross-workspace command center">
            Command center
          </SidebarLink>
          {emailPilot ? (
            <SidebarLink href="/assistant/mail" active={mail} title="Email pilot">
              Mail
            </SidebarLink>
          ) : null}
          <SidebarLink href="/assistant/workbench" active={workbench} title="Copilot workbench">
            Workbench
          </SidebarLink>
          <SidebarLink href="/assistant/execution" active={execution} title="Execution workbench">
            Execution
          </SidebarLink>
          <SidebarLink href="/assistant/autonomy" active={autonomy} title="Autonomy workbench">
            Autonomy
          </SidebarLink>
          <SidebarLink href="/assistant/work-engine" active={workEngine} title="Assistant work engine">
            Work engine
          </SidebarLink>
          <SidebarLink href="/assistant/evidence-quality" active={evidenceQuality} title="Evidence & quality">
            Evidence quality
          </SidebarLink>
          <SidebarLink href="/assistant/governed-automation" active={governedAutomation} title="Governed automation">
            Governed automation
          </SidebarLink>
          <SidebarLink href="/assistant/admin" active={admin} title="Admin console">
            Admin
          </SidebarLink>
          <SidebarLink href="/assistant/operating-system" active={operatingSystem} title="AI operating system">
            Operating system
          </SidebarLink>
        </SidebarGroup>

        <SidebarGroup label="Operations">
          <SidebarLink href="/assistant/order-orchestration" active={pathname.startsWith("/assistant/order-orchestration")}>
            Order orchestration
          </SidebarLink>
          <SidebarLink href="/assistant/warehouse-capacity" active={pathname.startsWith("/assistant/warehouse-capacity")}>
            Warehouse capacity
          </SidebarLink>
          <SidebarLink href="/assistant/exception-center" active={pathname.startsWith("/assistant/exception-center")}>
            Exception center
          </SidebarLink>
          <SidebarLink href="/assistant/customer-intelligence" active={pathname.startsWith("/assistant/customer-intelligence")}>
            Customer intelligence
          </SidebarLink>
          <SidebarLink href="/assistant/finance-control" active={pathname.startsWith("/assistant/finance-control")}>
            Finance control
          </SidebarLink>
          <SidebarLink href="/assistant/risk-war-room" active={pathname.startsWith("/assistant/risk-war-room")}>
            Risk war room
          </SidebarLink>
          <SidebarLink href="/assistant/master-data-quality" active={pathname.startsWith("/assistant/master-data-quality")}>
            Master data
          </SidebarLink>
          <SidebarLink href="/assistant/planning-bridge" active={pathname.startsWith("/assistant/planning-bridge")}>
            Planning
          </SidebarLink>
          <SidebarLink href="/assistant/contract-compliance" active={pathname.startsWith("/assistant/contract-compliance")}>
            Contracts
          </SidebarLink>
          <SidebarLink href="/assistant/sustainability" active={pathname.startsWith("/assistant/sustainability")}>
            Sustainability
          </SidebarLink>
          <SidebarLink href="/assistant/partner-ecosystem" active={pathname.startsWith("/assistant/partner-ecosystem")}>
            Partners
          </SidebarLink>
          <SidebarLink href="/assistant/frontline" active={pathname.startsWith("/assistant/frontline")}>
            Frontline
          </SidebarLink>
          <SidebarLink href="/assistant/meeting-intelligence" active={pathname.startsWith("/assistant/meeting-intelligence")}>
            Meetings
          </SidebarLink>
          <SidebarLink href="/assistant/observability" active={pathname.startsWith("/assistant/observability")}>
            Observability
          </SidebarLink>
          <SidebarLink href="/assistant/governance" active={pathname.startsWith("/assistant/governance")}>
            Governance
          </SidebarLink>
          <SidebarLink href="/assistant/rollout-factory" active={pathname.startsWith("/assistant/rollout-factory")}>
            Rollout
          </SidebarLink>
          <SidebarLink href="/assistant/value-realization" active={pathname.startsWith("/assistant/value-realization")}>
            Value
          </SidebarLink>
          <SidebarLink href="/assistant/autonomous-loop" active={pathname.startsWith("/assistant/autonomous-loop")}>
            Loop
          </SidebarLink>
          <SidebarLink href="/assistant/network-design" active={pathname.startsWith("/assistant/network-design")}>
            Network
          </SidebarLink>
          <SidebarLink href="/assistant/simulation-studio" active={pathname.startsWith("/assistant/simulation-studio")}>
            Simulation
          </SidebarLink>
          <SidebarLink href="/assistant/continuous-planning" active={pathname.startsWith("/assistant/continuous-planning")}>
            Plan control
          </SidebarLink>
          <SidebarLink href="/assistant/revenue-operations" active={pathname.startsWith("/assistant/revenue-operations")}>
            Revenue ops
          </SidebarLink>
        </SidebarGroup>

        <SidebarGroup label="Programs">
          <SidebarLink href="/assistant/sprint-workspaces" active={programTrackActive} title="Sprint 1–25 program workspaces">
            Browse program track ({SPRINT_WORKSPACE_ENTRIES.length})
          </SidebarLink>
          <SidebarLink href="/assistant/advanced-programs" active={onAdvancedProgramsRoute} title="AMP review packets">
            Advanced catalog ({advancedProgramCatalogCount})
          </SidebarLink>
        </SidebarGroup>
      </div>
    </aside>
  );
}
