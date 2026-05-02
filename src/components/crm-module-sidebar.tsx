"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";

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

export function CrmModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <ModuleSidebarAside aria-label="CRM navigation" className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}>
      <Link href="/crm" className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]">
        CRM home
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Workspace">
          {items.map(({ href, label }) => {
            const active =
              href === "/crm"
                ? pathname === "/crm"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <ModuleSidebarLink key={href} href={href} active={active}>
                {label}
              </ModuleSidebarLink>
            );
          })}
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
