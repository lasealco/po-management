"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleTertiarySubNavLinkInactiveClass,
  moduleTertiarySubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

const items = [
  {
    href: "/invoice-audit",
    label: "Intakes",
    match: (p: string) =>
      p === "/invoice-audit" ||
      (p.startsWith("/invoice-audit/") &&
        !p.startsWith("/invoice-audit/new") &&
        !p.startsWith("/invoice-audit/tolerance-rules") &&
        !p.startsWith("/invoice-audit/charge-aliases") &&
        !p.startsWith("/invoice-audit/readiness")),
  },
  {
    href: "/invoice-audit/tolerance-rules",
    label: "Tolerance rules",
    match: (p: string) => p.startsWith("/invoice-audit/tolerance-rules"),
  },
  {
    href: "/invoice-audit/charge-aliases",
    label: "Charge aliases",
    match: (p: string) => p.startsWith("/invoice-audit/charge-aliases"),
  },
  {
    href: "/invoice-audit/readiness",
    label: "DB readiness",
    match: (p: string) => p.startsWith("/invoice-audit/readiness"),
  },
  {
    href: "/invoice-audit/new",
    label: "New intake",
    match: (p: string) => p.startsWith("/invoice-audit/new"),
  },
];

export function InvoiceAuditSubNav() {
  const pathname = usePathname();
  return (
    <div className={moduleTertiarySubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Invoice audit
        </span>
        {items.map(({ href, label, match }) => {
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
