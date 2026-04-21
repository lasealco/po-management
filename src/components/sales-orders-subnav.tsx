"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

const ordersHref = "/sales-orders";
const traceHref = "/sales-orders/product-trace";

export function SalesOrdersSubNav() {
  const pathname = usePathname();

  const ordersActive =
    (pathname === ordersHref || pathname.startsWith(`${ordersHref}/`)) &&
    !pathname.startsWith(`${traceHref}`);
  const traceActive = pathname === traceHref || pathname.startsWith(`${traceHref}/`);

  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 py-2 sm:px-6" aria-label="Sales orders sections">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 sm:gap-x-1.5">
          <span className="mr-1 shrink-0 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)] sm:mr-2">
            Sales orders
          </span>
          <Link
            href={ordersHref}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
              ordersActive ? subNavActiveClass : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Orders
          </Link>
          <Link
            href={traceHref}
            aria-label="Product trace"
            title="Product trace"
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
              traceActive ? subNavActiveClass : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            Product Trace
          </Link>
        </div>
      </nav>
    </div>
  );
}
