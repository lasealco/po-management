"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMarkLink } from "@/components/brand-mark";
import type { AppNavLinkVisibility } from "@/lib/nav-visibility";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import {
  RATES_AUDIT_NAV_LABEL,
  isRatesAuditSectionPath,
  ratesAuditTopNavHref,
} from "@/lib/rates-audit-nav";
import { appNavActiveClass, appNavInactiveClass } from "@/lib/subnav-active-class";
import { TARIFF_CONTRACTS_DIRECTORY_PATH, TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

function isTopNavHrefActive(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname.startsWith("/settings");
  if (href === "/srm") {
    return (
      (pathname === "/srm" || pathname.startsWith("/srm/")) &&
      !pathname.startsWith("/srm/portal")
    );
  }
  if (href === "/srm/portal") return pathname === "/srm/portal" || pathname.startsWith("/srm/portal/");
  if (href === "/sales-orders") return pathname === "/sales-orders" || pathname.startsWith("/sales-orders/");
  if (href === "/assistant") {
    return (
      pathname === "/assistant" ||
      pathname.startsWith("/assistant/workbench") ||
      pathname.startsWith("/assistant/execution") ||
      pathname.startsWith("/assistant/autonomy") ||
      pathname.startsWith("/assistant/command-center") ||
      pathname.startsWith("/assistant/mail")
    );
  }
  if (href === "/assistant/inbox")
    return pathname === "/assistant/inbox" || pathname.startsWith("/assistant/inbox/");
  if (href === "/reporting") {
    return (
      pathname === "/reporting" ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname === "/crm/reporting" ||
      pathname === "/wms/reporting"
    );
  }
  if (href === "/crm") return pathname === "/crm" || pathname.startsWith("/crm/");
  if (href === "/control-tower") return pathname === "/control-tower" || pathname.startsWith("/control-tower/");
  if (href === TARIFF_CONTRACTS_DIRECTORY_PATH) return pathname.startsWith(TARIFFS_MODULE_BASE_PATH);
  if (href === "/pricing-snapshots") return pathname.startsWith("/pricing-snapshots");
  if (href === "/invoice-audit") return pathname.startsWith("/invoice-audit");
  if (href === "/rfq/requests") return pathname.startsWith("/rfq");
  if (href === "/apihub") return pathname === "/apihub" || pathname.startsWith("/apihub/");
  if (href === "/supply-chain-twin") {
    return pathname === "/supply-chain-twin" || pathname.startsWith("/supply-chain-twin/");
  }
  if (href === "/risk-intelligence") {
    return pathname === "/risk-intelligence" || pathname.startsWith("/risk-intelligence/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type TopNavItem =
  | { kind: "po"; key: "poManagement"; label: string; href: string }
  | {
      kind: "link";
      key: Exclude<keyof AppNavLinkVisibility, "poManagement">;
      label: string;
      href: string;
    }
  /** Hub for tariffs, snapshots, invoice audit, RFQ — visibility uses `pricingSnapshots` (tariffs ∨ RFQ ∨ invoice audit). */
  | { kind: "ratesAudit" };

const topNavItems: TopNavItem[] = [
  { kind: "link", key: "srmSupplierPortal", label: "Supplier workspace", href: "/srm/portal" },
  { kind: "link", key: "executive", label: "Executive", href: "/executive" },
  { kind: "link", key: "controlTower", label: "Control Tower", href: "/control-tower" },
  { kind: "link", key: "crm", label: "CRM", href: "/crm" },
  { kind: "link", key: "srm", label: "SRM", href: "/srm" },
  { kind: "link", key: "wms", label: "WMS", href: "/wms" },
  { kind: "po", key: "poManagement", label: "PO Management", href: "/orders" },
  { kind: "link", key: "salesOrders", label: "Sales Orders", href: "/sales-orders" },
  { kind: "link", key: "assistant", label: "AI Assistant", href: "/assistant" },
  { kind: "link", key: "inbox", label: "Inbox", href: "/assistant/inbox" },
  { kind: "link", key: "reports", label: "Reporting", href: "/reporting" },
  { kind: "link", key: "supplyChainTwin", label: "Supply Chain Twin", href: "/supply-chain-twin" },
  { kind: "link", key: "riskIntelligence", label: "Risk intelligence", href: "/risk-intelligence" },
  { kind: "ratesAudit" },
  { kind: "link", key: "apihub", label: "API Hub", href: "/apihub" },
  { kind: "link", key: "settings", label: "Settings", href: "/settings" },
];

/** Visible top-bar copy — keep full module names on `aria-label` / `title` on the `Link`. */
function TopNavLinkLabel({ item }: { item: Exclude<TopNavItem, { kind: "ratesAudit" }> }) {
  if (item.kind === "po") return "Purchase";
  if (item.key === "controlTower") return "Tower";
  if (item.key === "salesOrders") return "Sales";
  if (item.key === "assistant") return "AI";
  if (item.key === "inbox") return "Inbox";
  if (item.key === "executive") return "Exec";
  if (item.key === "reports") return "Reports";
  if (item.key === "apihub") return "API";
  if (item.key === "supplyChainTwin") return "Twin";
  if (item.key === "riskIntelligence") return "Risk";
  if (item.key === "srmSupplierPortal") return "Workspace";
  return item.label;
}

function navItemVisible(item: TopNavItem, linkVisibility: AppNavLinkVisibility | undefined, setupIncomplete: boolean) {
  if (setupIncomplete || !linkVisibility) return true;
  if (item.kind === "ratesAudit") return linkVisibility.pricingSnapshots;
  return linkVisibility[item.key];
}

export function AppNav({
  linkVisibility,
  setupIncomplete = false,
}: {
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete?: boolean;
}) {
  const pathname = usePathname();
  const visible = topNavItems.filter((item) => navItemVisible(item, linkVisibility, setupIncomplete));

  const poActive =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname.startsWith("/consolidation") ||
    pathname.startsWith("/products");

  const ratesAuditHref = ratesAuditTopNavHref(linkVisibility, setupIncomplete);

  return (
    <header className="sticky top-0 z-10 border-b-2 border-[var(--arscmp-primary)] bg-white shadow-[0_1px_0_rgba(22,91,103,0.06)]">
      {setupIncomplete ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 sm:text-left">
          <div className="mx-auto max-w-7xl">
            <strong className="font-semibold">Demo permissions missing.</strong>{" "}
            Users exist but this account has no role grants (
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              RolePermission
            </code>
            ). From your machine run{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              npm run db:seed
            </code>{" "}
            with the same{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              DATABASE_URL
            </code>{" "}
            as Vercel, then reload.
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex min-h-14 max-w-7xl flex-nowrap items-center gap-3 py-2 pl-2 pr-6 sm:gap-4 sm:pl-3 md:pl-6">
        <BrandMarkLink
          href={PLATFORM_HUB_PATH}
          className="shrink-0 py-1"
          aria-label="NEOLINK — platform home"
        />
        <nav
          className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          <div className="flex flex-nowrap items-center justify-end gap-x-1 whitespace-nowrap sm:gap-x-1">
            {visible.map((item) => {
              if (item.kind === "ratesAudit") {
                const active = isRatesAuditSectionPath(pathname);
                return (
                  <Link
                    key="rates-audit"
                    href={ratesAuditHref}
                    aria-label={RATES_AUDIT_NAV_LABEL}
                    title={RATES_AUDIT_NAV_LABEL}
                    className={`shrink-0 ${active ? appNavActiveClass : appNavInactiveClass}`}
                  >
                    Rates
                  </Link>
                );
              }

              const active =
                item.kind === "po" ? poActive : isTopNavHrefActive(pathname, item.href);
              const isSettings = item.kind === "link" && item.key === "settings";
              return (
                <Link
                  key={item.kind === "po" ? item.key : item.key}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={`shrink-0 ${isSettings ? "ml-1 border-l border-zinc-200 pl-3 sm:ml-2 sm:pl-4" : ""} ${
                    active ? appNavActiveClass : appNavInactiveClass
                  }`}
                >
                  <TopNavLinkLabel item={item} />
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
