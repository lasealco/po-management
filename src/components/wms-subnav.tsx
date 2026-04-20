"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

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
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <div className="mr-3 flex items-center gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
            WMS
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
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
