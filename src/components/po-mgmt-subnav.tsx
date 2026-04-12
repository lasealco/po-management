"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PoMgmtSubNavVisibility } from "@/lib/nav-visibility";

const items: { href: string; label: string; key: keyof PoMgmtSubNavVisibility }[] = [
  { href: "/", label: "Orders", key: "orders" },
  { href: "/consolidation", label: "Consolidations", key: "consolidation" },
  { href: "/products", label: "Products", key: "products" },
  { href: "/suppliers", label: "Suppliers", key: "suppliers" },
];

export function PoMgmtSubNav({ visibility }: { visibility: PoMgmtSubNavVisibility }) {
  const pathname = usePathname();
  const visibleItems = items.filter((i) => visibility[i.key]);
  if (visibleItems.length === 0) return null;

  return (
    <div className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
          PO Management
        </span>
        {visibleItems.map(({ href, label }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname.startsWith("/orders/")
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-violet-100 text-violet-900"
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
