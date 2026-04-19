"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

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
];

export function InvoiceAuditSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
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
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? subNavActiveClass : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/invoice-audit/new"
          className={`ml-auto rounded-md px-3 py-1.5 text-sm font-semibold ${
            pathname === "/invoice-audit/new"
              ? subNavActiveClass
              : "text-[var(--arscmp-primary)] hover:bg-[var(--arscmp-primary-50)]"
          }`}
        >
          New intake
        </Link>
      </div>
    </div>
  );
}
