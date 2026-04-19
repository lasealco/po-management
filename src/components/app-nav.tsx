"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMarkLink } from "@/components/brand-mark";
import type { AppNavLinkVisibility } from "@/lib/nav-visibility";

/** Top nav dropdown: tariffs, snapshots, invoice audit, RFQ. Rename here if you pick a final product name. */
const RATES_WORKSPACE_LABEL = "Rates workspace";

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
  if (href === "/tariffs/contracts") return pathname.startsWith("/tariffs");
  if (href === "/pricing-snapshots") return pathname.startsWith("/pricing-snapshots");
  if (href === "/invoice-audit") return pathname.startsWith("/invoice-audit");
  if (href === "/rfq/requests") return pathname.startsWith("/rfq");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ratesWorkspaceChildren: Array<{
  key: keyof AppNavLinkVisibility;
  label: string;
  href: string;
}> = [
  { key: "tariffs", label: "Tariffs", href: "/tariffs/contracts" },
  { key: "pricingSnapshots", label: "Pricing snapshots", href: "/pricing-snapshots" },
  { key: "invoiceAudit", label: "Invoice audit", href: "/invoice-audit" },
  { key: "rfq", label: "RFQ", href: "/rfq/requests" },
];

type TopNavItem =
  | { kind: "po"; key: "poManagement"; label: string; href: string }
  | {
      kind: "link";
      key: Exclude<keyof AppNavLinkVisibility, "poManagement">;
      label: string;
      href: string;
    }
  | { kind: "ratesWorkspace" };

const topNavItems: TopNavItem[] = [
  { kind: "po", key: "poManagement", label: "PO Management", href: "/orders" },
  { kind: "link", key: "salesOrders", label: "Sales Orders", href: "/sales-orders" },
  { kind: "link", key: "executive", label: "Executive", href: "/executive" },
  { kind: "link", key: "reports", label: "Reporting", href: "/reporting" },
  { kind: "link", key: "controlTower", label: "Control Tower", href: "/control-tower" },
  { kind: "link", key: "wms", label: "WMS", href: "/wms" },
  { kind: "link", key: "crm", label: "CRM", href: "/crm" },
  { kind: "link", key: "srm", label: "SRM", href: "/srm" },
  { kind: "ratesWorkspace" },
  { kind: "link", key: "settings", label: "Settings", href: "/settings" },
];

function navItemVisible(item: TopNavItem, linkVisibility: AppNavLinkVisibility | undefined, setupIncomplete: boolean) {
  if (setupIncomplete || !linkVisibility) return true;
  if (item.kind === "ratesWorkspace") {
    return ratesWorkspaceChildren.some((c) => linkVisibility[c.key]);
  }
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
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 pl-2 pr-6 sm:pl-3 md:pl-6">
        <BrandMarkLink
          href="/platform"
          className="mr-auto shrink-0 py-1"
          aria-label="AR SCMP — platform home"
        />
        <nav
          className="flex max-w-[min(100%,52rem)] flex-wrap items-center justify-end gap-x-1 gap-y-1 sm:gap-x-1"
          aria-label="Main"
        >
          {visible.map((item) => {
            if (item.kind === "ratesWorkspace") {
              const children = ratesWorkspaceChildren.filter(
                (c) => setupIncomplete || !linkVisibility || linkVisibility[c.key],
              );
              if (children.length === 0) return null;
              const groupActive = children.some((c) => isTopNavHrefActive(pathname, c.href));
              const linkClassActive =
                "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20";
              const linkClassIdle = "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900";
              return (
                <details key="rates-workspace" className="relative">
                  <summary
                    className={`flex cursor-pointer list-none items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 [&::-webkit-details-marker]:hidden ${
                      groupActive ? linkClassActive : linkClassIdle
                    }`}
                    aria-label={`${RATES_WORKSPACE_LABEL}: Tariffs, pricing snapshots, invoice audit, RFQ`}
                  >
                    {RATES_WORKSPACE_LABEL}
                    <span className="text-[10px] text-zinc-400" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div
                    className="absolute right-0 z-20 mt-1 min-w-[13.5rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
                    role="menu"
                    aria-label={RATES_WORKSPACE_LABEL}
                  >
                    {children.map((c) => {
                      const active = isTopNavHrefActive(pathname, c.href);
                      return (
                        <Link
                          key={c.key}
                          href={c.href}
                          role="menuitem"
                          className={`block px-3 py-2 text-sm font-medium ${
                            active ? linkClassActive : linkClassIdle
                          }`}
                          onClick={(e) => {
                            const root = (e.currentTarget as HTMLElement).closest("details");
                            if (root) root.open = false;
                          }}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                </details>
              );
            }

            const active =
              item.kind === "po" ? poActive : isTopNavHrefActive(pathname, item.href);
            const isSettings = item.kind === "link" && item.key === "settings";
            return (
              <Link
                key={item.kind === "po" ? item.key : item.key}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
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
        </nav>
      </div>
    </header>
  );
}
