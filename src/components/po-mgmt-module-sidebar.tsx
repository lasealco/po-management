"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";
import type { PoMgmtSubNavVisibility } from "@/lib/nav-visibility";

const items: { href: string; label: string; key: keyof PoMgmtSubNavVisibility }[] = [
  { href: "/orders", label: "Orders", key: "orders" },
  { href: "/product-trace", label: "Product trace", key: "productTrace" },
  { href: "/consolidation", label: "Consolidations", key: "consolidation" },
  { href: "/products", label: "Products", key: "products" },
];

export function PoMgmtModuleSidebar({
  visibility,
  className,
}: {
  visibility: PoMgmtSubNavVisibility;
  className?: string;
}) {
  const pathname = usePathname();
  const visibleItems = items.filter((i) => visibility[i.key]);
  if (visibleItems.length === 0) return null;

  return (
    <ModuleSidebarAside
      aria-label="Purchase workspace navigation"
      className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}
    >
      <Link href="/orders" className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]">
        PO workspace
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Workspace">
          {visibleItems.map(({ href, label }) => {
            const active =
              href === "/orders"
                ? pathname === "/orders" || pathname.startsWith("/orders/")
                : href === "/product-trace"
                  ? pathname === "/product-trace" ||
                    pathname.startsWith("/product-trace/") ||
                    pathname.startsWith("/control-tower/product-trace") ||
                    pathname.startsWith("/sales-orders/product-trace")
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
