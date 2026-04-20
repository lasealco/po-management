import Link from "next/link";

import { BrandMarkLink, SITE_BRAND_HEX } from "@/components/brand-mark";
import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

const MAIL_SALES = "mailto:sales@arscmp.com?subject=AR%20SCMP%20—%20";

const footnote =
  "Hosting (cloud infrastructure, regions, SLAs) and AI assistant usage are billed in addition based on consumption. Final commercial terms are confirmed in your order form.";

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

const MODULE_PACKAGES = [
  {
    id: "control-tower",
    title: "Control Tower",
    tagline: "Logistics visibility & execution",
    features: [
      "Shipment workspace, milestones, and exception signals",
      "Workbench, digest, and search across transport modes",
      "Reporting hooks aligned with your operating cadence",
    ],
  },
  {
    id: "po-management",
    title: "PO Management",
    tagline: "Procurement & order orchestration",
    features: [
      "Purchase orders, catalog, and supplier-linked workflows",
      "Consolidations and structured handoffs to logistics",
      "Operational reporting across buying activity",
    ],
  },
  {
    id: "wms",
    title: "WMS",
    tagline: "Warehouse operations",
    features: [
      "Inbound, inventory balances, and movement history",
      "Outbound pick / pack / ship with task discipline",
      "Setup, waves, and operational reporting",
    ],
  },
  {
    id: "crm",
    title: "CRM",
    tagline: "Commercial pipeline",
    features: [
      "Accounts, contacts, leads, and opportunities",
      "Pipeline views and activity tracking",
      "Reporting aligned with revenue motions",
    ],
  },
  {
    id: "srm",
    title: "SRM",
    tagline: "Supplier relationship management",
    features: [
      "Supplier 360, onboarding, and document signals",
      "Compliance-oriented views and follow-ups",
      "Supplier master integration endpoints (where enabled)",
    ],
  },
] as const;

export function MarketingPricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMarkLink href="/" className="py-1" aria-label="AR SCMP home" />
          <nav className="flex items-center gap-5 text-sm font-semibold text-slate-600">
            <Link href="/" className="transition hover:text-slate-900">
              Home
            </Link>
            <span className="text-slate-900" aria-current="page">
              Plans
            </span>
            <Link href={PLATFORM_HUB_PATH} className="transition hover:text-slate-900">
              Platform
            </Link>
            <a
              href={`${MAIL_SALES}Demo%20request`}
              className="rounded-lg px-3 py-1.5 text-white transition hover:opacity-95"
              style={{ backgroundColor: SITE_BRAND_HEX }}
            >
              Request demo
            </a>
          </nav>
        </div>
      </div>

      <header className="border-b border-slate-100 bg-gradient-to-b from-[#eef6f7] to-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Commercial</p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">
            Plans built for modular adoption — or the full platform.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Illustrative packages for conversations with our team. No self-serve checkout yet; we will
            align hosting, support, and AI usage with your rollout.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:space-y-20 lg:px-8 lg:py-20">
        {/* 1 — Free trial (strongest CTA) */}
        <section aria-labelledby="trial-heading">
          <div
            className="relative overflow-hidden rounded-3xl border-2 p-10 shadow-lg lg:p-12"
            style={{ borderColor: SITE_BRAND_HEX, background: `linear-gradient(135deg, ${SITE_BRAND_HEX}08 0%, #fff 45%, #fff 100%)` }}
          >
            <div
              className="absolute right-0 top-0 h-48 w-48 rounded-full opacity-[0.12] blur-3xl"
              style={{ backgroundColor: SITE_BRAND_HEX }}
            />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Start here</p>
                <h2 id="trial-heading" className="mt-2 text-3xl font-black text-slate-900 lg:text-4xl">
                  7-day evaluation
                </h2>
                <p className="mt-4 max-w-xl text-lg text-slate-600">
                  Guided access to explore workflows with your team. We help scope modules, users, and
                  infrastructure expectations before you commit.
                </p>
                <ul className="mt-6 space-y-2 text-slate-700">
                  {[
                    "Time-boxed environment suited to discovery",
                    "Walkthrough of the modules you care about first",
                    "Clear next step to production pricing & order form",
                  ].map((line) => (
                    <li key={line} className="flex gap-2 text-sm font-medium">
                      <span style={{ color: SITE_BRAND_HEX }}>
                        <CheckIcon />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-stretch gap-3 lg:w-64">
                <Link
                  href={PLATFORM_HUB_PATH}
                  className="rounded-2xl px-6 py-4 text-center text-lg font-bold text-white shadow-md transition hover:opacity-95"
                  style={{ backgroundColor: SITE_BRAND_HEX }}
                >
                  Start free evaluation
                </Link>
                <p className="text-center text-xs text-slate-500">No obligation. Commercial terms follow separately.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 — Enterprise all modules */}
        <section aria-labelledby="suite-heading">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="suite-heading" className="text-3xl font-black text-slate-900">
                Platform suite
              </h2>
              <p className="mt-1 text-slate-600">All operating modules — one subscription envelope.</p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-10 shadow-sm lg:p-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-2xl font-bold text-slate-900">Enterprise — full stack</h3>
                <p className="mt-2 text-slate-600">
                  Control Tower, PO Management, WMS, CRM, and SRM under one agreement (plus shared reporting
                  & platform services as rolled out for your tenant).
                </p>
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {[
                    "Cross-module navigation and role model",
                    "Single tenant context for procurement + logistics + commercial",
                    "Roadmap alignment for integrations and advanced modules",
                    "Priority onboarding with AR SCMP solutions contact",
                  ].map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-[var(--arscmp-primary)]">
                        <CheckIcon />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm lg:min-w-[280px]">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">From</p>
                <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">$99.99</p>
                <p className="text-sm font-semibold text-slate-600">USD / month</p>
                <p className="mt-3 text-sm text-slate-600">Includes up to <strong>10</strong> named users.</p>
                <a
                  href={`${MAIL_SALES}Enterprise%20suite%20—%20full%20platform`}
                  className="mt-6 block rounded-xl px-5 py-3.5 text-center text-sm font-bold text-white transition hover:opacity-95"
                  style={{ backgroundColor: SITE_BRAND_HEX }}
                >
                  Contact sales — full suite
                </a>
              </div>
            </div>
            <p className="mt-8 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">{footnote}</p>
          </div>
        </section>

        {/* 3 — Single modules (lighter CTAs) */}
        <section aria-labelledby="modules-heading">
          <div className="mb-8">
            <h2 id="modules-heading" className="text-3xl font-black text-slate-900">
              Individual modules
            </h2>
            <p className="mt-1 text-slate-600">
              Subscribe to what you need first; expand to the suite anytime.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {MODULE_PACKAGES.map((m) => (
              <article
                key={m.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-xl font-bold text-slate-900">{m.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{m.tagline}</p>
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <p className="text-3xl font-black tabular-nums text-slate-900">$9.99</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">USD / month · enterprise tier</p>
                  <p className="mt-2 text-sm text-slate-600">Includes up to <strong>10</strong> named users.</p>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-600">
                  {m.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-slate-400">
                        <CheckIcon />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${MAIL_SALES}${encodeURIComponent(m.title + " module")}`}
                  className="mt-8 block rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3 text-center text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                >
                  Book a consultation
                </a>
              </article>
            ))}
          </div>
          <p className="mt-8 text-xs leading-relaxed text-slate-500">{footnote}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center lg:px-10">
          <p className="text-sm font-semibold text-slate-800">Ready to see the product?</p>
          <p className="mt-2 text-sm text-slate-600">
            After you review plans, open the live platform hub for the demo tenant experience.
          </p>
          <Link
            href={PLATFORM_HUB_PATH}
            className="mt-5 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-95"
            style={{ backgroundColor: SITE_BRAND_HEX }}
          >
            Explore the live platform
          </Link>
        </section>

        <p className="pb-8 text-center text-[11px] leading-relaxed text-slate-400">
          Prices shown are indicative for marketing and investor discussions and do not constitute an offer
          or binding quote. Features and availability vary by deployment. AR SCMP reserves the right to
          update packaging and pricing prior to contract.
        </p>
      </main>

      <footer className="border-t border-slate-100 bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <BrandMarkLink href="/" />
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-slate-700">
              Home
            </Link>
            <Link href={LEGAL_PRIVACY_PATH} className="transition hover:text-slate-700">
              Privacy
            </Link>
            <Link href={LEGAL_TERMS_PATH} className="transition hover:text-slate-700">
              Terms
            </Link>
            <Link href={LEGAL_COOKIES_PATH} className="transition hover:text-slate-700">
              Cookies
            </Link>
            <Link href="/login" className="transition hover:text-slate-700">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
