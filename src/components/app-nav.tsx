"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", key: "orders" as const, label: "Orders" },
  { href: "/products", key: "products" as const, label: "Products" },
  { href: "/settings", key: "settings" as const, label: "Settings" },
  { href: "/suppliers", key: "suppliers" as const, label: "Suppliers" },
] as const;

export type AppNavLinkVisibility = {
  orders: boolean;
  products: boolean;
  settings: boolean;
  suppliers: boolean;
};

export function AppNav({
  linkVisibility,
}: {
  /** When set (logged-in demo user), only show links for granted resources. */
  linkVisibility?: AppNavLinkVisibility;
}) {
  const pathname = usePathname();
  const visible = linkVisibility
    ? links.filter((l) => linkVisibility[l.key])
    : [...links];

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900"
        >
          PO Management
        </Link>
        <nav className="flex gap-6" aria-label="Main">
          {visible.map(({ href, label }) => {
            const active =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/orders")
                : href === "/settings"
                  ? pathname.startsWith("/settings")
                  : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`border-b-2 pb-0.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
