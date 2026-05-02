"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleTertiarySubNavLinkInactiveClass,
  moduleTertiarySubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

export const PRICING_SNAPSHOTS_NAV_ITEMS = [
  {
    href: "/pricing-snapshots",
    label: "Library",
    match: (p: string) =>
      p === "/pricing-snapshots" ||
      (p.startsWith("/pricing-snapshots/") && !p.startsWith("/pricing-snapshots/new")),
  },
];

export function PricingSnapshotsSubNav() {
  const pathname = usePathname();
  return (
    <div className={moduleTertiarySubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Snapshots
        </span>
        {PRICING_SNAPSHOTS_NAV_ITEMS.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={active ? subNavActiveClass : moduleTertiarySubNavLinkInactiveClass}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/pricing-snapshots/new"
          className={
            pathname === "/pricing-snapshots/new"
              ? subNavActiveClass
              : "rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--arscmp-primary)] transition-colors hover:bg-zinc-100 sm:px-3"
          }
        >
          Freeze snapshot
        </Link>
      </div>
    </div>
  );
}
