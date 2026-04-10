"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", key: "orders" as const, label: "Orders" },
  { href: "/reports", key: "reports" as const, label: "Reports" },
  { href: "/consolidation", key: "consolidation" as const, label: "Consolidation" },
  { href: "/products", key: "products" as const, label: "Products" },
  { href: "/settings", key: "settings" as const, label: "Settings" },
  { href: "/suppliers", key: "suppliers" as const, label: "Suppliers" },
] as const;

export type AppNavLinkVisibility = {
  orders: boolean;
  reports: boolean;
  consolidation: boolean;
  products: boolean;
  settings: boolean;
  suppliers: boolean;
};

export function AppNav({
  linkVisibility,
  setupIncomplete = false,
}: {
  /** When set (logged-in demo user), only show links for granted resources. */
  linkVisibility?: AppNavLinkVisibility;
  /** User exists but has zero role grants (e.g. DB never seeded) — show all links + setup hint. */
  setupIncomplete?: boolean;
}) {
  const pathname = usePathname();
  const visible =
    setupIncomplete || !linkVisibility
      ? [...links]
      : links.filter((l) => linkVisibility[l.key]);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {setupIncomplete ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 sm:text-left">
          <div className="mx-auto max-w-7xl">
            <strong className="font-semibold">Demo permissions missing.</strong>{" "}
            Users exist but this account has no role grants (
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              RolePermission
            </code>
            ). From your machine run{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              npm run db:seed
            </code>{" "}
            with the same{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              DATABASE_URL
            </code>{" "}
            as Vercel, then reload.
          </div>
        </div>
      ) : null}
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
                  : href === "/reports"
                    ? pathname === "/reports" || pathname.startsWith("/reports/")
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
