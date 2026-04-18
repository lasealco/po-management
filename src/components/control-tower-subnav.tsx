"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";
import { subNavActiveClass } from "@/lib/subnav-active-class";

const baseItems: { href: string; label: string }[] = [
  { href: "/control-tower", label: "Dashboard" },
  { href: "/control-tower/dashboard", label: "My dashboard" },
  { href: "/control-tower/workbench", label: "Workbench" },
  { href: "/control-tower/shipments/new", label: "New booking" },
  { href: "/control-tower/command-center", label: "Command center" },
  { href: "/control-tower/ops", label: "Ops console" },
  { href: "/control-tower/reports", label: "Reports" },
  { href: REPORTING_HUB_CONTROL_TOWER_HREF, label: "Reporting hub" },
  { href: "/control-tower/search", label: "Search & assist" },
  /** Cross-link: SKU → PO lines, in-transit map, warehouse stock (same grants as product trace page). */
  { href: "/product-trace", label: "Product trace" },
];

const digestItem = { href: "/control-tower/digest", label: "Digest" } as const;

export function ControlTowerSubNav({ includeDigestNav = false }: { includeDigestNav?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = includeDigestNav
    ? [
        ...baseItems.slice(0, 3),
        digestItem,
        ...baseItems.slice(3),
      ]
    : baseItems;

  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Control Tower
        </span>
        {items.map(({ href, label }) => {
          const active =
            href === REPORTING_HUB_CONTROL_TOWER_HREF
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
                        (pathname.startsWith("/control-tower/shipments/") &&
                          pathname !== "/control-tower/shipments/new")
                      : href === "/control-tower/digest"
                        ? pathname === href || pathname.startsWith(`${href}/`)
                        : href === "/control-tower/command-center"
                          ? pathname === href || pathname.startsWith(`${href}/`)
                          : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? subNavActiveClass
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
