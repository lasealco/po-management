"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";
import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";

type NavItem = { href: string; label: string; ariaLabel?: string };

const primaryBase: NavItem[] = [
  { href: "/control-tower", label: "Dashboard" },
  { href: "/control-tower/dashboard", label: "My Dashboard" },
  { href: "/control-tower/workbench", label: "Workbench" },
  { href: "/control-tower/map", label: "Map" },
  { href: "/control-tower/shipments/new", label: "Booking", ariaLabel: "New booking" },
];

const secondaryBase: NavItem[] = [
  { href: "/control-tower/command-center", label: "Command", ariaLabel: "Command center" },
  { href: "/control-tower/ops", label: "Operation", ariaLabel: "Ops console" },
  { href: "/control-tower/reports", label: "Reports" },
  { href: REPORTING_HUB_CONTROL_TOWER_HREF, label: "Reporting hub" },
  { href: "/control-tower/search", label: "Search", ariaLabel: "Search and assist" },
];

const digestItem: NavItem = { href: "/control-tower/digest", label: "Digest" };

const productTraceItem = {
  href: "/control-tower/product-trace",
  label: "Product Trace",
  ariaLabel: "Product trace",
} as const;

export function ControlTowerModuleSidebar({
  includeDigestNav = false,
  className,
}: {
  includeDigestNav?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const primaryItems = includeDigestNav
    ? [...primaryBase.slice(0, 2), digestItem, ...primaryBase.slice(2)]
    : primaryBase;

  function isItemActive(href: string): boolean {
    const productTracePaths =
      pathname === "/product-trace" ||
      pathname.startsWith("/product-trace/") ||
      pathname === "/control-tower/product-trace" ||
      pathname.startsWith("/control-tower/product-trace/") ||
      pathname === "/sales-orders/product-trace" ||
      pathname.startsWith("/sales-orders/product-trace/");
    return href === REPORTING_HUB_CONTROL_TOWER_HREF
      ? pathname === "/reporting" && searchParams.get("focus") === "control-tower"
      : href === productTraceItem.href
        ? productTracePaths
        : href === "/control-tower"
          ? pathname === "/control-tower"
          : href === "/control-tower/shipments/new"
            ? pathname === href
            : href === "/control-tower/map"
              ? pathname === href
              : href === "/control-tower/workbench"
                ? pathname === href ||
                  pathname.startsWith(`${href}/`) ||
                  (pathname.startsWith("/control-tower/shipments/") && pathname !== "/control-tower/shipments/new")
                : href === "/control-tower/digest"
                  ? pathname === href || pathname.startsWith(`${href}/`)
                  : href === "/control-tower/command-center"
                    ? pathname === href || pathname.startsWith(`${href}/`)
                    : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <ModuleSidebarAside
      aria-label="Control Tower navigation"
      className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}
    >
      <Link
        href="/control-tower"
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        Control Tower home
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Overview">
          {primaryItems.map(({ href, label, ariaLabel }) => (
            <ModuleSidebarLink key={href} href={href} active={isItemActive(href)} title={ariaLabel ?? label}>
              {label}
            </ModuleSidebarLink>
          ))}
          <ModuleSidebarLink
            href={productTraceItem.href}
            active={isItemActive(productTraceItem.href)}
            title={productTraceItem.ariaLabel}
          >
            {productTraceItem.label}
          </ModuleSidebarLink>
        </ModuleSidebarSection>
        <ModuleSidebarSection label="Tools">
          {secondaryBase.map(({ href, label, ariaLabel }) => (
            <ModuleSidebarLink key={href} href={href} active={isItemActive(href)} title={ariaLabel ?? label}>
              {label}
            </ModuleSidebarLink>
          ))}
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
