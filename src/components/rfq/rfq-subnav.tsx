"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleTertiarySubNavLinkInactiveClass,
  moduleTertiarySubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

export const RFQ_WORKBENCH_NAV_ITEMS = [
  {
    href: "/rfq/requests",
    label: "Requests",
    match: (p: string) =>
      p === "/rfq/requests" || (p.startsWith("/rfq/requests/") && !p.startsWith("/rfq/requests/new")),
  },
  {
    href: "/rfq/requests/new",
    label: "New request",
    match: (p: string) => p.startsWith("/rfq/requests/new"),
  },
  {
    href: "/rfq/procurement",
    label: "Procurement",
    match: (p: string) => p.startsWith("/rfq/procurement"),
  },
];

export function RfqSubNav() {
  const pathname = usePathname();
  return (
    <div className={moduleTertiarySubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          RFQ
        </span>
        {RFQ_WORKBENCH_NAV_ITEMS.map(({ href, label, match }) => {
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
      </div>
    </div>
  );
}
