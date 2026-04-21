"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";
import { subNavActiveClass } from "@/lib/subnav-active-class";

type SubNavItem = { href: string; label: string };

const primaryBase: SubNavItem[] = [
  { href: "/control-tower", label: "Dashboard" },
  { href: "/control-tower/dashboard", label: "My dashboard" },
  { href: "/control-tower/workbench", label: "Workbench" },
  { href: "/control-tower/shipments/new", label: "New booking" },
];

const secondaryBase: SubNavItem[] = [
  { href: "/control-tower/command-center", label: "Command center" },
  { href: "/control-tower/ops", label: "Ops console" },
  { href: "/control-tower/reports", label: "Reports" },
  { href: REPORTING_HUB_CONTROL_TOWER_HREF, label: "Reporting hub" },
  { href: "/control-tower/search", label: "Search & assist" },
];

const digestItem = { href: "/control-tower/digest", label: "Digest" } as const;

/** Cross-link: SKU → PO lines, in-transit map, warehouse stock (same grants as product trace page). */
const productTraceItem = { href: "/product-trace", label: "Product trace" } as const;

export function ControlTowerSubNav({ includeDigestNav = false }: { includeDigestNav?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const primaryItems = includeDigestNav
    ? [...primaryBase.slice(0, 2), digestItem, ...primaryBase.slice(2)]
    : primaryBase;
  const secondaryItems = secondaryBase;

  function isItemActive(href: string): boolean {
    return href === REPORTING_HUB_CONTROL_TOWER_HREF
      ? pathname === "/reporting" && searchParams.get("focus") === "control-tower"
      : href === "/product-trace"
        ? pathname === "/product-trace" || pathname.startsWith("/product-trace/")
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
    <div className="border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50/40 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="shrink-0 lg:pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
              Control Tower
            </p>
            <Link
              href={productTraceItem.href}
              className={`mt-1 inline-flex text-xs font-medium transition-colors ${
                productTraceActive ? "text-[var(--arscmp-primary)]" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {productTraceItem.label}
            </Link>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {primaryItems.map(({ href, label }) => {
                const active = isItemActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                      active
                        ? subNavActiveClass
                        : "text-zinc-600 hover:bg-white hover:text-zinc-900 hover:ring-1 hover:ring-zinc-200/80"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="h-px w-full bg-zinc-200/80" aria-hidden />

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Operations &amp; insight
              </p>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                {secondaryItems.map(({ href, label }) => {
                  const active = isItemActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                        active
                          ? subNavActiveClass
                          : "text-zinc-600 hover:bg-white hover:text-zinc-900 hover:ring-1 hover:ring-zinc-200/80"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
