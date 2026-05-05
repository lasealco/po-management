import type { Metadata } from "next";
import Link from "next/link";

import { BrandMarkLink } from "@/components/brand-mark";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { getViewerGrantSet } from "@/lib/authz";
import type { AppNavLinkVisibility } from "@/lib/nav-visibility";
import { resolveNavState } from "@/lib/nav-visibility";
import { DEMO_INTRO_PATH, MARKETING_PRICING_PATH, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import { ratesAuditTopNavHref } from "@/lib/rates-audit-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NEOLINK — Platform",
  description: "Choose a workspace: POs, Control Tower, WMS, CRM, SRM, and more.",
  alternates: { canonical: PLATFORM_HUB_PATH },
};

type ModuleCard = {
  href: string;
  title: string;
  description: string;
};

export default async function PlatformHomePage() {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  if (!access) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16">
        <BrandMarkLink href="/" className="mb-8 py-1" aria-label="NEOLINK home" />
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Welcome</h1>
        <p className="mt-4 text-zinc-600">
          Demo tenant not found. Run{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">npm run db:seed</code> locally,
          then deploy.
        </p>
      </main>
    );
  }

  const user = access.user;
  const v = linkVisibility;

  const modules: ModuleCard[] = [];
  if (v?.poManagement) {
    modules.push({
      href: "/orders",
      title: "PO Management",
      description: "Manage purchase orders, supplier coordination, and product-level execution queues.",
    });
  }
  if (v?.salesOrders) {
    modules.push({
      href: "/sales-orders",
      title: "Sales Orders",
      description: "Track customer demand, status transitions, and fulfillment handoff readiness.",
    });
  }
  if (v?.inbox && !v?.assistant) {
    modules.push({
      href: "/assistant/inbox",
      title: "Assistant Inbox",
      description:
        "One attention list: open Control Tower alerts and exceptions, plus draft sales orders, so you can work items without opening every module.",
    });
  }
  if (v?.assistant) {
    modules.push({
      href: "/assistant",
      title: "AI Sales assistant",
      description:
        v?.controlTower && v?.inbox
          ? "Natural language to draft sales orders: match CRM customers and products, clarify when needed, open the real SO in one click. Use the Inbox tab in Assistant for open Tower work and other drafts."
          : "Natural language to draft sales orders: match CRM customers and products, clarify when needed, open the real SO in one click.",
    });
  }
  if (v?.reports) {
    modules.push({
      href: "/executive",
      title: "Executive Dashboard",
      description: "Board-level snapshot for demand, risk, throughput, and capital exposure.",
    });
    modules.push({
      href: "/reporting",
      title: "Reporting",
      description: "Cross-module analytics hub for KPI drilldowns and trend monitoring.",
    });
  }
  if (v?.controlTower) {
    modules.push({
      href: "/control-tower",
      title: "Control Tower",
      description: "End-to-end shipment visibility, exceptions, and operational command workflows.",
    });
  }
  if (v?.supplyChainTwin) {
    modules.push({
      href: "/supply-chain-twin",
      title: "Supply Chain Twin",
      description:
        "Cross-module intelligence layer — live digital model of supply, demand, inventory, transport, cost, and risk (spec in docs/sctwin).",
    });
  }
  if (v?.wms) {
    modules.push({
      href: "/wms",
      title: "WMS",
      description: "Warehouse execution, stock ledger, tasks, and fulfillment operations.",
    });
  }
  if (v?.crm) {
    modules.push({
      href: "/crm",
      title: "CRM",
      description: "Pipeline, account intelligence, opportunity tracking, and commercial workflows.",
    });
  }
  if (v?.srm) {
    modules.push({
      href: "/srm",
      title: "SRM",
      description: "Supplier lifecycle, onboarding controls, and relationship management.",
    });
  }
  if (v?.apihub) {
    modules.push({
      href: "/apihub",
      title: "API Hub",
      description: "Integration control center for connector runs, mapping previews, and ingestion health.",
    });
  }
  if (v?.pricingSnapshots) {
    modules.push({
      href: ratesAuditTopNavHref(v as AppNavLinkVisibility, false),
      title: "Rates & Audit",
      description:
        "Contracts, charge-code catalog, geography groups, import staging, frozen pricing snapshots, RFQ comparison, and invoice audit against snapshots.",
    });
  }
  if (v?.settings) {
    modules.push({
      href: "/settings",
      title: "Settings",
      description: "Users, roles, and organization.",
    });
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-zinc-50 via-white to-zinc-50">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8 sm:pt-10">
        <PageTitleWithHint
          title="Run procurement and logistics in one place."
          titleClassName="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl"
        />
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          PO workflow, Control Tower, warehouse, and CRM — pick a workspace below or use the top
          navigation and command palette (
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
            Ctrl K
          </kbd>{" "}
          or{" "}
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
            ⌘K
          </kbd>
          ) for quick jumps, including plans & pricing and the public privacy, terms, and cookie pages.
        </p>

        <p className="mt-3 text-sm text-zinc-600">
          <Link
            href={DEMO_INTRO_PATH}
            className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
          >
            First time presenting? Start with the 2-page guided demo →
          </Link>
        </p>

        {!user ? (
          <div className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-950">Choose a demo user</h2>
            <p className="mt-2 text-sm text-amber-900/90">
              Open{" "}
              <Link
                href="/settings/demo"
                className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
              >
                Settings → Demo session
              </Link>{" "}
              to pick who you are acting as, then come back here. This environment uses demo accounts
              for investor and buyer walkthroughs.
            </p>
            <p className="mt-4 text-sm text-amber-900/80">
              Password sign-in:{" "}
              <Link
                href="/login"
                className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-800">{user.name}</span> (
            {user.email}).
          </p>
        )}

        {user && modules.length > 0 ? (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="group flex h-full flex-col rounded-2xl border border-zinc-200/90 border-l-4 border-l-[var(--arscmp-primary)] bg-gradient-to-br from-[var(--arscmp-primary-50)]/40 to-white p-6 shadow-sm transition-all hover:border-[var(--arscmp-primary)]/35 hover:shadow-md"
                >
                  <span className="text-lg font-semibold text-zinc-900 group-hover:text-[var(--arscmp-primary)]">
                    {m.title}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                    {m.description}
                  </span>
                  <span className="mt-4 text-sm font-medium text-[var(--arscmp-primary)]">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {user && modules.length === 0 ? (
          <p className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 text-zinc-600">
            No modules are available for this account yet. Ask an administrator to assign roles, or
            run{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">npm run db:seed</code> on this
            database.
          </p>
        ) : null}

        <p className="mt-10 text-center text-sm text-zinc-500">
          <Link href="/" className="text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
            ← Back to overview
          </Link>
        </p>

        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-zinc-200/80 pt-8 text-xs text-zinc-500"
          aria-label="Public site"
        >
          <Link href="/" className="underline-offset-2 hover:text-zinc-800 hover:underline">
            Home
          </Link>
          <Link href={MARKETING_PRICING_PATH} className="underline-offset-2 hover:text-zinc-800 hover:underline">
            Plans & pricing
          </Link>
        </nav>
      </div>
    </main>
  );
}
