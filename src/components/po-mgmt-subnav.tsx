"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PoMgmtSubNavVisibility } from "@/lib/nav-visibility";
import {
  moduleSubNavLinkInactiveClass,
  moduleSubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";

const items: { href: string; label: string; key: keyof PoMgmtSubNavVisibility }[] = [
  { href: "/orders", label: "Orders", key: "orders" },
  { href: "/product-trace", label: "Product trace", key: "productTrace" },
  { href: "/consolidation", label: "Consolidations", key: "consolidation" },
  { href: "/products", label: "Products", key: "products" },
];

export function PoMgmtSubNav({ visibility }: { visibility: PoMgmtSubNavVisibility }) {
  const pathname = usePathname();
  const visibleItems = items.filter((i) => visibility[i.key]);
  if (visibleItems.length === 0) return null;

  return (
    <div className={moduleSubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          PO Management
        </span>
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
