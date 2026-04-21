"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";
import {
  moduleSubNavLinkInactiveClass,
  moduleSubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

type SubNavItem = { href: string; label: string; ariaLabel?: string };

const primaryBase: SubNavItem[] = [
  { href: "/control-tower", label: "Dashboard" },
  { href: "/control-tower/dashboard", label: "My Dashboard" },
  { href: "/control-tower/workbench", label: "Workbench" },
  { href: "/control-tower/shipments/new", label: "Booking", ariaLabel: "New booking" },
];

const secondaryBase: SubNavItem[] = [
  { href: "/control-tower/command-center", label: "Command", ariaLabel: "Command center" },
  { href: "/control-tower/ops", label: "Operation", ariaLabel: "Ops console" },
  { href: "/control-tower/reports", label: "Reports" },
  { href: REPORTING_HUB_CONTROL_TOWER_HREF, label: "Reporting hub" },
  { href: "/control-tower/search", label: "Search", ariaLabel: "Search and assist" },
];

const digestItem: SubNavItem = { href: "/control-tower/digest", label: "Digest" };

/** Cross-link: SKU → PO lines, in-transit map, warehouse stock (same grants as product trace page). */
const productTraceItem = {
  href: "/control-tower/product-trace",
  label: "Product Trace",
  ariaLabel: "Product trace",
} as const;

function chipClasses(active: boolean) {
  return active ? subNavActiveClass : moduleSubNavLinkInactiveClass;
}

export function ControlTowerSubNav({ includeDigestNav = false }: { includeDigestNav?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const primaryItems = includeDigestNav
    ? [...primaryBase.slice(0, 2), digestItem, ...primaryBase.slice(2)]
    : primaryBase;
  const secondaryItems = secondaryBase;

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

  const productTraceActive = isItemActive(productTraceItem.href);

  return (
    <div className={moduleSubNavShellClass}>
      <nav
        className="mx-auto max-w-7xl px-4 py-2 sm:px-6"
        aria-label="Control Tower sections"
      >
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 sm:gap-x-1.5">
          <span className="mr-1 shrink-0 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)] sm:mr-2">
            Control Tower
          </span>

          {primaryItems.map(({ href, label, ariaLabel }) => {
            const active = isItemActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={ariaLabel ?? label}
                title={ariaLabel ?? label}
                className={`shrink-0 ${chipClasses(active)}`}
              >
                {label}
              </Link>
            );
          })}

          <Link
            href={productTraceItem.href}
            aria-label={productTraceItem.ariaLabel}
            title={productTraceItem.ariaLabel}
            className={`shrink-0 ${chipClasses(productTraceActive)}`}
          >
            {productTraceItem.label}
          </Link>

          <span
            className="mx-0.5 hidden h-5 w-px shrink-0 self-center bg-zinc-200 sm:block"
            aria-hidden
          />

          {secondaryItems.map(({ href, label, ariaLabel }, index) => {
            const active = isItemActive(href);
            const groupStart = index === 0 ? "ml-1 border-l border-zinc-200 pl-2 sm:ml-0 sm:border-l-0 sm:pl-0" : "";
            return (
              <Link
                key={href}
                href={href}
                aria-label={ariaLabel ?? label}
                title={ariaLabel ?? label}
                className={`shrink-0 ${groupStart} ${chipClasses(active)}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
