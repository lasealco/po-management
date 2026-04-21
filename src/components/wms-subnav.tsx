"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleSubNavLinkInactiveClass,
  moduleSubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

const items: { href: string; label: string }[] = [
  { href: "/wms", label: "Overview" },
  { href: "/wms/reporting", label: "Reporting" },
  { href: "/wms/setup", label: "Setup" },
  { href: "/wms/operations", label: "Operations" },
  { href: "/wms/stock", label: "Stock & ledger" },
  { href: "/wms/billing", label: "Billing" },
];

export function WmsSubNav() {
  const pathname = usePathname();

  return (
    <div className={moduleSubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <div className="mr-3 flex items-center gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
            WMS
          </span>
          <span className="rounded-full border border-[var(--arscmp-primary)]/20 bg-white/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
            Live workspace
          </span>
        </div>
        {items.map(({ href, label }) => {
          const active =
            href === "/wms" ? pathname === "/wms" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={active ? subNavActiveClass : moduleSubNavLinkInactiveClass}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
