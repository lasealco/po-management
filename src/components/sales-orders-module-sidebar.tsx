"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";

const ordersHref = "/sales-orders";
const traceHref = "/sales-orders/product-trace";

export function SalesOrdersModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  const ordersActive =
    (pathname === ordersHref || pathname.startsWith(`${ordersHref}/`)) && !pathname.startsWith(`${traceHref}`);
  const traceActive = pathname === traceHref || pathname.startsWith(`${traceHref}/`);

  return (
    <ModuleSidebarAside
      aria-label="Sales orders navigation"
      className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}
    >
      <Link
        href={ordersHref}
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        Sales orders home
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Workspace">
          <ModuleSidebarLink href={ordersHref} active={ordersActive}>
            Orders
          </ModuleSidebarLink>
          <ModuleSidebarLink href={traceHref} active={traceActive} title="Product trace">
            Product Trace
          </ModuleSidebarLink>
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
