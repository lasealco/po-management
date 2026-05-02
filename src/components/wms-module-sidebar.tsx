"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";

const items: { href: string; label: string }[] = [
  { href: "/wms", label: "Overview" },
  { href: "/wms/reporting", label: "Reporting" },
  { href: "/wms/setup", label: "Setup" },
  { href: "/wms/operations", label: "Operations" },
  { href: "/wms/stock", label: "Stock & ledger" },
  { href: "/wms/billing", label: "Billing" },
];

export function WmsModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <ModuleSidebarAside
      aria-label="WMS workspace navigation"
      className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}
    >
      <Link
        href="/wms"
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        WMS home
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Live workspace">
          {items.map(({ href, label }) => {
            const active =
              href === "/wms" ? pathname === "/wms" : pathname === href || pathname.startsWith(`${href}/`);
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
