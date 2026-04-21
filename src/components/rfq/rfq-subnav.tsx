"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleSubNavLinkInactiveClass,
  moduleSubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

const items = [
  { href: "/rfq/requests", label: "Requests", match: (p: string) => p === "/rfq/requests" || p.startsWith("/rfq/requests/") },
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
        <Link
          href="/rfq/requests/new"
          className={`ml-auto ${
            pathname === "/rfq/requests/new"
              ? subNavActiveClass
              : "rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--arscmp-primary)] transition-colors hover:bg-white/55 sm:px-3"
          }`}
        >
          New request
        </Link>
      </div>
    </div>
  );
}
