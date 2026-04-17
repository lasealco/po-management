"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

const items: { href: string; label: string }[] = [
  { href: "/crm", label: "Overview" },
  { href: "/crm/reporting", label: "Reporting" },
  { href: "/crm/leads", label: "Leads" },
  { href: "/crm/accounts", label: "Accounts" },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/opportunities", label: "Opportunities" },
  { href: "/crm/pipeline", label: "Pipeline" },
  { href: "/crm/quotes", label: "Quotes" },
  { href: "/crm/activities", label: "Activities" },
];

export function CrmSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          CRM
        </span>
        {items.map(({ href, label }) => {
          const active =
            href === "/crm"
              ? pathname === "/crm"
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
