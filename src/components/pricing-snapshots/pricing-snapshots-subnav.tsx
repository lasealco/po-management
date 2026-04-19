"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

const items = [
  {
    href: "/pricing-snapshots",
    label: "Library",
    match: (p: string) =>
      p === "/pricing-snapshots" ||
      (p.startsWith("/pricing-snapshots/") && !p.startsWith("/pricing-snapshots/new")),
  },
];

export function PricingSnapshotsSubNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Snapshots
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
          href="/pricing-snapshots/new"
          className={`ml-auto rounded-md px-3 py-1.5 text-sm font-semibold ${
            pathname === "/pricing-snapshots/new"
              ? subNavActiveClass
              : "text-[var(--arscmp-primary)] hover:bg-[var(--arscmp-primary-50)]"
          }`}
        >
          Freeze snapshot
        </Link>
      </div>
    </div>
  );
}
