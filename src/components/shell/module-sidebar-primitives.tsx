"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { appNavActiveClass, appNavInactiveClass } from "@/lib/subnav-active-class";

/** Matches Assistant workspace sidebar panel styling. */
export const MODULE_SIDEBAR_ASIDE_CLASS =
  "rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto";

export function ModuleSidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-200 pb-3 last:border-b-0 last:pb-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <div className="flex flex-col gap-0.5 text-sm">{children}</div>
    </div>
  );
}

export function ModuleSidebarLink({
  href,
  active,
  title,
  children,
  className,
}: {
  href: string;
  active: boolean;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={`${active ? appNavActiveClass : appNavInactiveClass} ${className ?? ""}`.trim()}
    >
      {children}
    </Link>
  );
}

export function ModuleWorkspaceShell({
  sidebar,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-[1600px] px-4 py-5 sm:px-6 ${className ?? ""}`}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {sidebar}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function ModuleSidebarAside({
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"aside">, "className"> & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={`${MODULE_SIDEBAR_ASIDE_CLASS} ${className ?? ""}`} {...rest}>
      {children}
    </aside>
  );
}
