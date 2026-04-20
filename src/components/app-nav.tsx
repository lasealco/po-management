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
import { TARIFF_CONTRACTS_DIRECTORY_PATH, TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

function isTopNavHrefActive(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname.startsWith("/settings");
  if (href === "/srm") return pathname === "/srm" || pathname.startsWith("/srm/");
  if (href === "/sales-orders") return pathname === "/sales-orders" || pathname.startsWith("/sales-orders/");
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
  { kind: "po", key: "poManagement", label: "PO Management", href: "/orders" },
  { kind: "link", key: "salesOrders", label: "Sales Orders", href: "/sales-orders" },
  { kind: "link", key: "executive", label: "Executive", href: "/executive" },
  { kind: "link", key: "reports", label: "Reporting", href: "/reporting" },
  { kind: "link", key: "controlTower", label: "Control Tower", href: "/control-tower" },
  { kind: "link", key: "wms", label: "WMS", href: "/wms" },
  { kind: "link", key: "crm", label: "CRM", href: "/crm" },
  { kind: "link", key: "srm", label: "SRM", href: "/srm" },
  { kind: "ratesAudit" },
  { kind: "link", key: "settings", label: "Settings", href: "/settings" },
];

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
    pathname.startsWith("/product-trace") ||
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
          aria-label="AR SCMP — platform home"
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
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                      active
                        ? "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                  >
                    {RATES_AUDIT_NAV_LABEL}
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
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                    isSettings ? "ml-1 border-l border-zinc-200 pl-3 sm:ml-2 sm:pl-4" : ""
                  } ${
                    active
                      ? "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
