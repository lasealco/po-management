"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_SECTIONS } from "@/lib/settings-nav";

function SettingsSidebarLink({
  href,
  pathname,
  label,
  description,
  exact,
}: {
  href: string;
  pathname: string;
  label: string;
  description: string;
  exact?: boolean;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`block -ml-px rounded-r-md border-l-2 py-1.5 pl-2 text-sm hover:border-zinc-300 hover:text-zinc-900 ${
        active
          ? "border-zinc-900 font-medium text-zinc-900"
          : "border-transparent text-zinc-600"
      }`}
    >
      <span className="block">{label}</span>
      <span
        className={`mt-0.5 block text-xs font-normal ${active ? "text-zinc-600" : "text-zinc-500"}`}
      >
        {description}
      </span>
    </Link>
  );
}

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Settings
      </h1>
      <nav className="mt-4 space-y-6" aria-label="Settings sections">
        <div>
          <p className="text-sm font-medium text-zinc-900">General</p>
          <ul className="mt-2 space-y-0.5 border-l border-zinc-200 pl-3">
            <li>
              <SettingsSidebarLink
                href="/settings"
                pathname={pathname}
                label="Overview"
                description="All settings areas"
                exact
              />
            </li>
            <li>
              <SettingsSidebarLink
                href="/settings/demo"
                pathname={pathname}
                label="Demo session"
                description="Switch demo user or clear session"
                exact
              />
            </li>
          </ul>
        </div>
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-sm font-medium text-zinc-900">{section.title}</p>
            <ul className="mt-2 space-y-0.5 border-l border-zinc-200 pl-3">
              {section.links.map((link) => (
                <li key={link.href}>
                  <SettingsSidebarLink
                    href={link.href}
                    pathname={pathname}
                    label={link.label}
                    description={link.description}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
