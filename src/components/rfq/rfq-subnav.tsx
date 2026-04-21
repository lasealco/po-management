"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleSubNavLinkInactiveClass,
  moduleSubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

const items = [
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
];

export function RfqSubNav() {
  const pathname = usePathname();
  return (
    <div className={moduleSubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          RFQ
        </span>
        {items.map(({ href, label, match }) => {
          const active = match(pathname);
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
