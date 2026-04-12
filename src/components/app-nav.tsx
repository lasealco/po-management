"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AppNavLinkVisibility } from "@/lib/nav-visibility";

type TopNavItem =
  | { kind: "po"; key: "poManagement"; label: string; href: string }
  | {
      kind: "link";
      key: Exclude<keyof AppNavLinkVisibility, "poManagement">;
      label: string;
      href: string;
    };

const topNavItems: TopNavItem[] = [
  { kind: "po", key: "poManagement", label: "PO Management", href: "/" },
  { kind: "link", key: "reports", label: "Reporting", href: "/reports" },
  { kind: "link", key: "wms", label: "WMS", href: "/wms" },
  { kind: "link", key: "crm", label: "CRM", href: "/crm" },
  { kind: "link", key: "settings", label: "Settings", href: "/settings" },
];

export function AppNav({
  linkVisibility,
  setupIncomplete = false,
}: {
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete?: boolean;
}) {
  const pathname = usePathname();
  const visible =
    setupIncomplete || !linkVisibility
      ? [...topNavItems]
      : topNavItems.filter((item) => linkVisibility[item.key]);

  const poActive =
    pathname === "/" ||
    pathname.startsWith("/orders/") ||
    pathname.startsWith("/consolidation") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/suppliers");

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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-zinc-900"
          aria-label="ARSCMP home"
        >
          <Image
            src="/arscmp-logo.png"
            alt=""
            width={132}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="text-sm font-semibold tracking-tight">ARSCMP</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1" aria-label="Main">
          {visible.map((item) => {
            const active =
              item.kind === "po"
                ? poActive
                : item.href === "/settings"
                  ? pathname.startsWith("/settings")
                  : item.href === "/reports"
                    ? pathname === "/reports" || pathname.startsWith("/reports/")
                    : item.href === "/crm"
                      ? pathname === "/crm" || pathname.startsWith("/crm/")
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`border-b-2 pb-0.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
