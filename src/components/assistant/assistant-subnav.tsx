"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { appNavActiveClass, appNavInactiveClass } from "@/lib/subnav-active-class";

export function AssistantSubnav() {
  const pathname = usePathname() ?? "";
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

  const chat = pathname === "/assistant" || pathname === "/assistant/";
  const orderOrchestration = pathname.startsWith("/assistant/order-orchestration");
  const warehouseCapacity = pathname.startsWith("/assistant/warehouse-capacity");
  const exceptionCenter = pathname.startsWith("/assistant/exception-center");
  const customerIntelligence = pathname.startsWith("/assistant/customer-intelligence");
  const financeControl = pathname.startsWith("/assistant/finance-control");
  const riskWarRoom = pathname.startsWith("/assistant/risk-war-room");
  const masterDataQuality = pathname.startsWith("/assistant/master-data-quality");
  const planningBridge = pathname.startsWith("/assistant/planning-bridge");
  const contractCompliance = pathname.startsWith("/assistant/contract-compliance");
  const sustainability = pathname.startsWith("/assistant/sustainability");
  const partnerEcosystem = pathname.startsWith("/assistant/partner-ecosystem");
  const frontline = pathname.startsWith("/assistant/frontline");
  const meetingIntelligence = pathname.startsWith("/assistant/meeting-intelligence");
  const observability = pathname.startsWith("/assistant/observability");
  const governance = pathname.startsWith("/assistant/governance");
  const rolloutFactory = pathname.startsWith("/assistant/rollout-factory");
  const valueRealization = pathname.startsWith("/assistant/value-realization");
  const workbench = pathname.startsWith("/assistant/workbench");
  const execution = pathname.startsWith("/assistant/execution");
  const workEngine = pathname.startsWith("/assistant/work-engine");
  const evidenceQuality = pathname.startsWith("/assistant/evidence-quality");
  const governedAutomation = pathname.startsWith("/assistant/governed-automation");
  const admin = pathname.startsWith("/assistant/admin");
  const operatingSystem = pathname.startsWith("/assistant/operating-system");
  const autonomy = pathname.startsWith("/assistant/autonomy");
  const inbox = pathname.startsWith("/assistant/inbox");
  const commandCenter = pathname.startsWith("/assistant/command-center");
  const mail = pathname.startsWith("/assistant/mail");

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3 text-sm">
      <Link
        href="/assistant"
        className={chat ? appNavActiveClass : appNavInactiveClass}
        title="Sales assistant"
      >
        Chat
      </Link>
      <Link
        href="/assistant/order-orchestration"
        className={orderOrchestration ? appNavActiveClass : appNavInactiveClass}
        title="AMP13 AI-native order orchestration"
      >
        Order orchestration
      </Link>
      <Link
        href="/assistant/warehouse-capacity"
        className={warehouseCapacity ? appNavActiveClass : appNavInactiveClass}
        title="AMP15 warehouse labor and capacity command"
      >
        Warehouse capacity
      </Link>
      <Link
        href="/assistant/exception-center"
        className={exceptionCenter ? appNavActiveClass : appNavInactiveClass}
        title="AMP17 end-to-end exception nerve center"
      >
        Exception center
      </Link>
      <Link
        href="/assistant/customer-intelligence"
        className={customerIntelligence ? appNavActiveClass : appNavInactiveClass}
        title="AMP18 customer service and account intelligence"
      >
        Customer intelligence
      </Link>
      <Link
        href="/assistant/finance-control"
        className={financeControl ? appNavActiveClass : appNavInactiveClass}
        title="AMP19 financial control tower"
      >
        Finance control
      </Link>
      <Link
        href="/assistant/risk-war-room"
        className={riskWarRoom ? appNavActiveClass : appNavInactiveClass}
        title="AMP20 risk intelligence war room"
      >
        Risk war room
      </Link>
      <Link
        href="/assistant/master-data-quality"
        className={masterDataQuality ? appNavActiveClass : appNavInactiveClass}
        title="AMP21 master data quality and enrichment"
      >
        Master data
      </Link>
      <Link
        href="/assistant/planning-bridge"
        className={planningBridge ? appNavActiveClass : appNavInactiveClass}
        title="AMP22 AI planning and S&OP bridge"
      >
        Planning
      </Link>
      <Link
        href="/assistant/contract-compliance"
        className={contractCompliance ? appNavActiveClass : appNavInactiveClass}
        title="AMP23 contract lifecycle and compliance"
      >
        Contracts
      </Link>
      <Link
        href="/assistant/sustainability"
        className={sustainability ? appNavActiveClass : appNavInactiveClass}
        title="AMP24 sustainability and ESG operations"
      >
        Sustainability
      </Link>
      <Link
        href="/assistant/partner-ecosystem"
        className={partnerEcosystem ? appNavActiveClass : appNavInactiveClass}
        title="AMP25 marketplace and partner ecosystem"
      >
        Partners
      </Link>
      <Link
        href="/assistant/frontline"
        className={frontline ? appNavActiveClass : appNavInactiveClass}
        title="AMP26 mobile and frontline assistant"
      >
        Frontline
      </Link>
      <Link
        href="/assistant/meeting-intelligence"
        className={meetingIntelligence ? appNavActiveClass : appNavInactiveClass}
        title="AMP27 voice and meeting intelligence"
      >
        Meetings
      </Link>
      <Link
        href="/assistant/observability"
        className={observability ? appNavActiveClass : appNavInactiveClass}
        title="AMP28 AI observability and incident response"
      >
        Observability
      </Link>
      <Link
        href="/assistant/governance"
        className={governance ? appNavActiveClass : appNavInactiveClass}
        title="AMP29 enterprise data governance and retention"
      >
        Governance
      </Link>
      <Link
        href="/assistant/rollout-factory"
        className={rolloutFactory ? appNavActiveClass : appNavInactiveClass}
        title="AMP30 multi-tenant rollout and implementation factory"
      >
        Rollout
      </Link>
      <Link
        href="/assistant/value-realization"
        className={valueRealization ? appNavActiveClass : appNavInactiveClass}
        title="AMP31 AI product analytics and value realization"
      >
        Value
      </Link>
      <Link
        href="/assistant/workbench"
        className={workbench ? appNavActiveClass : appNavInactiveClass}
        title="LMP1-LMP10 copilot workbench"
      >
        Workbench
      </Link>
      <Link
        href="/assistant/execution"
        className={execution ? appNavActiveClass : appNavInactiveClass}
        title="LMP11-LMP30 execution workbench"
      >
        Execution
      </Link>
      <Link
        href="/assistant/work-engine"
        className={workEngine ? appNavActiveClass : appNavInactiveClass}
        title="AMP6 assistant work engine"
      >
        Work engine
      </Link>
      <Link
        href="/assistant/evidence-quality"
        className={evidenceQuality ? appNavActiveClass : appNavInactiveClass}
        title="AMP7 evidence, quality, and training"
      >
        Evidence quality
      </Link>
      <Link
        href="/assistant/governed-automation"
        className={governedAutomation ? appNavActiveClass : appNavInactiveClass}
        title="AMP8 governed automation"
      >
        Governed automation
      </Link>
      <Link
        href="/assistant/admin"
        className={admin ? appNavActiveClass : appNavInactiveClass}
        title="AMP11 admin, rollout, security, and compliance"
      >
        Admin
      </Link>
      <Link
        href="/assistant/operating-system"
        className={operatingSystem ? appNavActiveClass : appNavInactiveClass}
        title="AMP12 customer-ready AI operating system"
      >
        Operating system
      </Link>
      <Link
        href="/assistant/autonomy"
        className={autonomy ? appNavActiveClass : appNavInactiveClass}
        title="LMP31-LMP50 autonomy workbench"
      >
        Autonomy
      </Link>
      <Link
        href="/assistant/inbox"
        className={inbox ? appNavActiveClass : appNavInactiveClass}
        title="Open items"
      >
        Inbox
        {inboxCount != null && inboxCount > 0 ? (
          <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-zinc-200 px-1.5 text-[11px] font-semibold text-zinc-800">
            {inboxCount > 99 ? "99+" : inboxCount}
          </span>
        ) : null}
      </Link>
      <Link
        href="/assistant/command-center"
        className={commandCenter ? appNavActiveClass : appNavInactiveClass}
        title="Cross-workspace command center"
      >
        Command center
      </Link>
      {emailPilot ? (
        <Link
          href="/assistant/mail"
          className={mail ? appNavActiveClass : appNavInactiveClass}
          title="Email pilot (manual import, confirm before send)"
        >
          Mail
        </Link>
      ) : null}
    </div>
  );
}
