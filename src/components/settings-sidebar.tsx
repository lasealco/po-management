"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SettingsSection = {
  title: string;
  links: readonly {
    href: string;
    label: string;
    description: string;
  }[];
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    title: "Product catalog",
    links: [
      {
        href: "/settings/catalog",
        label: "Categories & divisions",
        description: "Taxonomy used on products",
      },
    ],
  },
] as const;

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 lg:w-56">
      <h1 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Settings
      </h1>
      <nav className="mt-4 space-y-6" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-sm font-medium text-zinc-900">{section.title}</p>
            <ul className="mt-2 space-y-0.5 border-l border-zinc-200 pl-3">
              {section.links.map((link) => {
                const active =
                  pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch
                      aria-current={active ? "page" : undefined}
                      className={`block -ml-px rounded-r-md border-l-2 py-1.5 pl-2 text-sm hover:border-zinc-300 hover:text-zinc-900 ${
                        active
                          ? "border-zinc-900 font-medium text-zinc-900"
                          : "border-transparent text-zinc-600"
                      }`}
                    >
                      <span className="block">{link.label}</span>
                      <span
                        className={`mt-0.5 block text-xs font-normal ${active ? "text-zinc-600" : "text-zinc-500"}`}
                      >
                        {link.description}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
