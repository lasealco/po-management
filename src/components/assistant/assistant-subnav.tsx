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
  const autonomousLoop = pathname.startsWith("/assistant/autonomous-loop");
  const networkDesign = pathname.startsWith("/assistant/network-design");
  const simulationStudio = pathname.startsWith("/assistant/simulation-studio");
  const continuousPlanning = pathname.startsWith("/assistant/continuous-planning");
  const revenueOperations = pathname.startsWith("/assistant/revenue-operations");
  const advancedProgram = (slug: string) => pathname.startsWith(`/assistant/advanced-programs/${slug}`);
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
        href="/assistant/autonomous-loop"
        className={autonomousLoop ? appNavActiveClass : appNavInactiveClass}
        title="AMP32 autonomous supply-chain operating loop"
      >
        Loop
      </Link>
      <Link
        href="/assistant/network-design"
        className={networkDesign ? appNavActiveClass : appNavInactiveClass}
        title="AMP33 network design and footprint strategy"
      >
        Network
      </Link>
      <Link
        href="/assistant/simulation-studio"
        className={simulationStudio ? appNavActiveClass : appNavInactiveClass}
        title="AMP34 multi-scenario simulation studio"
      >
        Simulation
      </Link>
      <Link
        href="/assistant/continuous-planning"
        className={continuousPlanning ? appNavActiveClass : appNavInactiveClass}
        title="AMP35 continuous planning control tower"
      >
        Plan control
      </Link>
      <Link
        href="/assistant/revenue-operations"
        className={revenueOperations ? appNavActiveClass : appNavInactiveClass}
        title="AMP36 quote-to-contract revenue operations"
      >
        Revenue ops
      </Link>
      {[
        ["aftermarket-service", "Service", "AMP37 aftermarket service and spare-parts"],
        ["npi-readiness", "NPI", "AMP38 product lifecycle and NPI readiness"],
        ["quality-capa", "CAPA", "AMP39 quality management and CAPA"],
        ["trade-compliance", "Trade", "AMP40 trade compliance and customs operations"],
        ["landed-cost", "Landed", "AMP41 landed cost and duty optimization"],
        ["regulatory-obligations", "Reg", "AMP42 regulatory obligation operations"],
        ["energy-utilities", "Energy", "AMP43 energy and utilities operations"],
        ["packaging-optimization", "Packaging", "AMP44 packaging and material-flow optimization"],
        ["manufacturing-coordination", "Mfg", "AMP45 manufacturing execution coordination"],
        ["production-scheduling", "Schedule", "AMP46 advanced production scheduling"],
        ["category-strategy", "Sourcing", "AMP47 category strategy and sourcing"],
        ["spend-intelligence", "Spend", "AMP48 spend intelligence and savings realization"],
        ["supplier-resilience", "Resilience", "AMP49 supplier risk and resilience due diligence"],
        ["workforce-enablement", "Training", "AMP50 workforce enablement and role training"],
        ["knowledge-sop", "SOPs", "AMP51 enterprise knowledge and SOP management"],
        ["document-intelligence", "Docs AI", "AMP52 document intelligence operations"],
        ["vision-evidence", "Vision", "AMP53 computer-vision evidence"],
        ["iot-telemetry", "IoT", "AMP54 IoT and asset telemetry operations"],
        ["semantic-metrics", "Metrics", "AMP55 semantic data layer and metric governance"],
        ["extension-marketplace", "SDK", "AMP56 assistant extension marketplace and SDK"],
        ["evaluation-lab", "Eval lab", "AMP57 evaluation, simulation, and red-team lab"],
        ["security-dlp", "DLP", "AMP58 security operations and data-loss prevention"],
        ["business-continuity", "Crisis", "AMP59 business continuity and crisis command"],
        ["autonomous-finance", "Fin ops", "AMP60 autonomous finance operations"],
        ["customer-ecosystem", "Customer cmd", "AMP61 customer ecosystem command"],
        ["executive-cockpit", "Exec cockpit", "AMP62 executive autonomous enterprise cockpit"],
        ["capex-investment", "Capex", "AMP64 capital expenditure and asset investment"],
        ["ma-integration", "M&A", "AMP65 M&A operational integration"],
        ["divestiture-readiness", "Carve-out", "AMP66 divestiture and carve-out readiness"],
        ["ai-negotiation", "Negotiate", "AMP67 AI negotiation co-pilot"],
        ["dynamic-pricing", "Pricing", "AMP68 dynamic pricing and margin optimization"],
        ["revenue-leakage", "Leakage", "AMP69 revenue leakage recovery"],
        ["warranty-claims", "Claims", "AMP70 warranty and claims operations"],
        ["reverse-logistics", "Returns", "AMP71 reverse logistics and returns optimization"],
        ["circular-economy", "Circular", "AMP72 circular economy and reuse"],
        ["supplier-innovation", "Innovation", "AMP73 supplier innovation and co-development"],
        ["product-profitability", "SKU profit", "AMP74 product profitability command"],
        ["customer-profitability", "Cust profit", "AMP75 customer profitability and service-cost"],
        ["carrier-performance", "Carrier", "AMP76 carrier performance and allocation"],
        ["port-congestion", "Port", "AMP77 port and terminal congestion command"],
        ["cold-chain", "Cold chain", "AMP78 cold-chain compliance and excursion"],
        ["hazmat-dg", "Hazmat", "AMP79 hazmat and dangerous goods operations"],
        ["food-safety", "Food safety", "AMP80 food safety and traceability"],
        ["pharma-gxp", "GxP", "AMP81 pharma GDP/GxP operations"],
        ["aerospace-defense", "Aero/def", "AMP82 aerospace and defense compliance"],
        ["automotive-ppap", "PPAP", "AMP83 automotive launch and PPAP"],
        ["retail-replenishment", "Retail repl", "AMP84 retail replenishment and shelf availability"],
        ["omnichannel-promise", "Omni promise", "AMP85 omnichannel order promise"],
        ["field-service", "Field svc", "AMP86 field service operations"],
        ["project-logistics", "Project cargo", "AMP87 project logistics and heavy-lift"],
        ["construction-supply", "Construction", "AMP88 construction supply coordination"],
        ["healthcare-resilience", "Healthcare", "AMP89 healthcare supply resilience"],
        ["public-procurement", "Public buy", "AMP90 public-sector procurement compliance"],
        ["contingent-workforce", "Contractors", "AMP91 contractor and contingent workforce"],
        ["risk-register", "Risk reg", "AMP92 enterprise risk register"],
        ["internal-audit", "Audit", "AMP93 internal audit and control testing"],
        ["policy-waivers", "Waivers", "AMP94 policy exception and waiver"],
        ["privacy-dsar", "DSAR", "AMP95 privacy operations and DSAR"],
        ["data-residency", "Residency", "AMP96 data residency and cross-border transfer"],
        ["model-risk", "Model risk", "AMP97 model risk management"],
        ["prompt-lifecycle", "Prompts", "AMP98 prompt lifecycle management"],
        ["automation-policy", "Auto policy", "AMP99 automation policy lifecycle"],
        ["human-review-ops", "Review ops", "AMP100 human-in-the-loop operations"],
      ].map(([slug, label, title]) => (
        <Link
          key={slug}
          href={`/assistant/advanced-programs/${slug}`}
          className={advancedProgram(slug) ? appNavActiveClass : appNavInactiveClass}
          title={title}
        >
          {label}
        </Link>
      ))}
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
