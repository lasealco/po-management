import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMarkLink } from "@/components/brand-mark";
import {
  DEMO_INTRO_HIGHLIGHTS_PATH,
  DEMO_INTRO_PATH,
  PLATFORM_HUB_PATH,
} from "@/lib/marketing-public-paths";

export function DemoIntroShell({
  step,
  children,
}: {
  step: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <BrandMarkLink href="/" className="py-1" aria-label="NEOLINK home" />
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
              Guided demo · {step} / 2
            </span>
            <Link href={PLATFORM_HUB_PATH} className="hover:text-zinc-900 hover:underline">
              Platform hub
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

export function DemoIntroFooterNav({ step }: { step: 1 | 2 }) {
  const secondary =
    "rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50";
  const primary =
    "rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95";

  return (
    <nav
      className="mt-12 flex flex-col gap-4 border-t border-zinc-200 pt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      aria-label="Demo intro navigation"
    >
      <div className="flex flex-wrap gap-3">
        {step === 2 ? (
          <Link href={DEMO_INTRO_PATH} className={`${secondary} inline-flex items-center justify-center`}>
            ← Back to overview
          </Link>
        ) : (
          <Link href="/" className={`${secondary} inline-flex items-center justify-center`}>
            ← Marketing home
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {step === 1 ? (
          <Link href={DEMO_INTRO_HIGHLIGHTS_PATH} className={`${primary} inline-flex items-center justify-center`}>
            Continue: highlights & entry points
          </Link>
        ) : (
          <>
            <Link href="/settings/demo" className={`${secondary} inline-flex items-center justify-center`}>
              Choose demo user
            </Link>
            <Link href={PLATFORM_HUB_PATH} className={`${primary} inline-flex items-center justify-center`}>
              Open platform hub
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
