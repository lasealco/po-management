"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

const items = [
  { href: "/rfq/requests", label: "Requests", match: (p: string) => p === "/rfq/requests" || p.startsWith("/rfq/requests/") },
];

export function RfqSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          RFQ
        </span>
        {items.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? subNavActiveClass : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/rfq/requests/new"
          className={`ml-auto rounded-md px-3 py-1.5 text-sm font-semibold ${
            pathname === "/rfq/requests/new"
              ? subNavActiveClass
              : "text-[var(--arscmp-primary)] hover:bg-[var(--arscmp-primary-50)]"
          }`}
        >
          New request
        </Link>
      </div>
    </div>
  );
}
