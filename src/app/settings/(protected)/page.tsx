import Link from "next/link";

import { SETTINGS_SECTIONS } from "@/lib/settings-nav";

export default function SettingsHomePage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Overview</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600">
        Configure your tenant: organization profile, product taxonomy, and how
        purchase orders move through statuses.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SETTINGS_SECTIONS.flatMap((section) =>
          section.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50/80"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {section.title}
                </p>
                <p className="mt-2 font-medium text-zinc-900">{link.label}</p>
                <p className="mt-1 text-sm text-zinc-600">{link.description}</p>
              </Link>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
