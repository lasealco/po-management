"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppNavLinkVisibility } from "@/lib/nav-visibility";
import { RATES_AUDIT_NAV_LABEL, isRatesAuditSectionPath, ratesAuditSubNavItems } from "@/lib/rates-audit-nav";
import { subNavActiveClass } from "@/lib/subnav-active-class";

function subNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/tariffs/contracts") return pathname.startsWith("/tariffs");
  if (href === "/pricing-snapshots") return pathname.startsWith("/pricing-snapshots");
  if (href === "/invoice-audit") return pathname.startsWith("/invoice-audit");
  if (href === "/rfq/requests") return pathname.startsWith("/rfq");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LayoutRatesAuditSubnav({
  linkVisibility,
  setupIncomplete = false,
}: {
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete?: boolean;
}) {
  const pathname = usePathname();
  if (!isRatesAuditSectionPath(pathname)) return null;

  const visibleItems = ratesAuditSubNavItems.filter(
    (i) => setupIncomplete || !linkVisibility || linkVisibility[i.key],
  );
  if (visibleItems.length === 0) return null;

  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          {RATES_AUDIT_NAV_LABEL}
        </span>
        {visibleItems.map(({ href, label }) => {
          const active = subNavLinkActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? subNavActiveClass : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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
