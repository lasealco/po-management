import Link from "next/link";

import { BrandMarkLink, SITE_BRAND_HEX } from "@/components/brand-mark";

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMarkLink href="/" className="py-1" aria-label="AR SCMP home" />
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600 sm:gap-5">
            <Link href="/pricing" className="transition hover:text-slate-900">
              Plans &amp; pricing
            </Link>
            <Link href="/platform" className="hidden transition hover:text-slate-900 sm:inline">
              Platform
            </Link>
            <a
              href="mailto:sales@arscmp.com?subject=Demo%20request"
              className="rounded-lg px-3 py-1.5 text-white transition hover:opacity-95"
              style={{ backgroundColor: SITE_BRAND_HEX }}
            >
              Demo
            </a>
          </nav>
        </div>
      </div>
      <header className="relative overflow-hidden py-20 lg:py-32">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="mb-6 text-5xl font-black leading-[1.1] text-slate-900 lg:text-7xl">
              Run procurement and logistics in one place.
            </h1>
            <p className="mb-10 text-xl leading-relaxed text-slate-600">
              AR SCMP is a modular supply chain management platform that connects PO management, sales
              orders, control tower visibility, warehouse operations, reporting, CRM, and supplier
              management — with future-ready extensions for pricing, tenders, and invoice auditing.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <a
                href="#demo"
                className="rounded-xl px-8 py-4 text-center text-lg font-bold text-white shadow-lg transition-all hover:opacity-95"
                style={{ backgroundColor: SITE_BRAND_HEX }}
              >
                Request a Demo
              </a>
              <Link
                href="/pricing"
                className="rounded-xl border-2 border-slate-200 px-8 py-4 text-center text-lg font-bold text-slate-700 transition-all hover:bg-slate-50"
              >
                Plans &amp; pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              <Link href="/platform" className="font-semibold text-[#165B67] underline-offset-2 hover:underline">
                Explore the live platform
              </Link>{" "}
              when you are ready to click through the demo hub.
            </p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-full w-1/2 rounded-full bg-slate-50 opacity-50 blur-3xl" />
      </header>

      <section id="problem" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-black">
                Most supply chain teams still work across too many disconnected tools.
              </h2>
              <div className="space-y-4 text-lg text-slate-600">
                <p>
                  Purchase orders live in one place. Shipment tracking sits in emails and carrier
                  portals. Warehouse processes run elsewhere. Customer information is maintained
                  separately.
                </p>
                <p>
                  Reporting is manual. Supplier performance is hard to compare. Commercial decisions are
                  slowed down by fragmented data.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
              <p className="mb-4 text-2xl font-bold italic" style={{ color: SITE_BRAND_HEX }}>
                &ldquo;AR SCMP changes that by bringing these workflows together into one connected
                platform.&rdquo;
              </p>
              <div className="h-1 w-20 rounded-full" style={{ backgroundColor: SITE_BRAND_HEX }} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-12 text-4xl font-black">Built for teams that need real control.</h2>
          <div className="grid gap-8 text-left md:grid-cols-3">
            <div className="space-y-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${SITE_BRAND_HEX}1a` }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: SITE_BRAND_HEX }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040L3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622l-1.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Better Execution</h3>
              <p className="text-slate-600">
                Fewer handoffs, fewer blind spots, and structured data for faster decision-making.
              </p>
            </div>
            <div className="space-y-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${SITE_BRAND_HEX}1a` }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: SITE_BRAND_HEX }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Full Visibility</h3>
              <p className="text-slate-600">
                See what is happening across orders, shipments, and warehouse activity in real-time.
              </p>
            </div>
            <div className="space-y-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${SITE_BRAND_HEX}1a` }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: SITE_BRAND_HEX }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Modular Growth</h3>
              <p className="text-slate-600">
                Start with the modules you need today and expand as your business complexity grows.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="bg-slate-900 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-black">Core Operating Modules</h2>
            <p className="text-xl text-slate-400">A complete platform suite built for operational depth.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              {
                cat: "Operational",
                title: "PO Management",
                desc: "Manage purchase orders, suppliers, and consolidations in a structured workflow.",
              },
              {
                cat: "Operational",
                title: "Sales Orders",
                desc: "Capture customer orders and support seamless fulfillment handoffs.",
              },
              {
                cat: "Intelligence",
                title: "Reporting",
                desc: "Access analytics across all modules with one connected reporting layer.",
              },
              {
                cat: "Logistics",
                title: "Control Tower",
                desc: "Track shipments and milestones across air, ocean, rail, and truck.",
              },
              {
                cat: "Warehousing",
                title: "WMS",
                desc: "Structured inbound, storage, inventory, and outbound execution.",
              },
              {
                cat: "Commercial",
                title: "CRM",
                desc: "Manage customer pipeline, opportunities, and commercial visibility.",
              },
              {
                cat: "Relationships",
                title: "SRM",
                desc: "Manage suppliers and logistics providers with performance oversight.",
              },
            ].map((m) => (
              <div
                key={m.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/10"
              >
                <h4
                  className="mb-3 text-xs font-bold uppercase tracking-widest"
                  style={{ color: SITE_BRAND_HEX }}
                >
                  {m.cat}
                </h4>
                <h3 className="mb-2 text-xl font-bold">{m.title}</h3>
                <p className="text-sm text-slate-400">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-24 border-t border-white/10 pt-16">
            <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="mb-4 text-3xl font-black">Strategic Roadmap</h2>
                <p className="text-lg text-slate-400">
                  Strengthening execution and cost governance with near-future modules.
                </p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: "Tariff & Pricing", desc: "Manage logistics pricing in a structured and scalable way." },
                { title: "Tender Management", desc: "Support sourcing workflows for transport and logistics services." },
                {
                  title: "Invoice Auditing",
                  desc: "Validate supplier invoices against agreed rates and operational reality.",
                },
              ].map((m) => (
                <div
                  key={m.title}
                  className="group relative overflow-hidden rounded-2xl border p-8"
                  style={{ backgroundColor: `${SITE_BRAND_HEX}1a`, borderColor: `${SITE_BRAND_HEX}33` }}
                >
                  <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
                    <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{m.title}</h3>
                  <p className="text-sm text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-4xl font-black">Why companies choose AR SCMP</h2>
          <div className="grid gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Replace fragmented workflows",
                d: "Reduce dependence on spreadsheets, emails, and multiple disconnected external portals.",
              },
              {
                t: "Create one source of truth",
                d: "Connect orders, shipments, warehouse activity, suppliers, and customers in one platform.",
              },
              {
                t: "Improve visibility and control",
                d: "See what is happening earlier and respond faster through structured alerts and tracking.",
              },
              {
                t: "Increase operational discipline",
                d: "Use structured workflows, milestone logic, and controlled execution processes.",
              },
              {
                t: "Commercial & Ops alignment",
                d: "AR SCMP combines execution support with CRM, SRM, and reporting for full visibility.",
              },
              {
                t: "Scale over time",
                d: "Our modular approach means you only pay for what you need as your business grows.",
              },
            ].map((x) => (
              <div key={x.t}>
                <h3 className="mb-4 text-xl font-black">{x.t}</h3>
                <p className="leading-relaxed text-slate-600">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-10 text-3xl font-black">Designed for modern logistics leaders.</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "Importers & Exporters",
              "Retailers & Distributors",
              "Manufacturers",
              "3PLs & Freight Forwarders",
              "Procurement Teams",
              "Warehouse Operators",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-[3rem] p-12 text-white lg:p-20"
            style={{ backgroundColor: SITE_BRAND_HEX }}
          >
            <div className="relative z-10 max-w-2xl">
              <h2 className="mb-8 text-4xl font-black lg:text-5xl">More than a logistics tool</h2>
              <p className="mb-8 text-xl leading-relaxed opacity-90">
                AR SCMP is not just a tracking platform or a warehouse system. It is a modular supply
                chain operating platform designed to connect the full workflow around procurement,
                logistics, warehousing, and commercial management.
              </p>
              <p className="text-lg italic opacity-80">
                &ldquo;Built around real operational workflows, AR SCMP is designed for businesses that
                need practical control — not just dashboard visibility.&rdquo;
              </p>
            </div>
            <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-white/10 blur-3xl" />
          </div>
        </div>
      </section>

      <section id="demo" className="py-24 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-5xl font-black">
            Bring procurement, logistics, and operations together.
          </h2>
          <p className="mb-12 text-xl text-slate-600">
            Whether you want to improve visibility, reduce manual work, or build a more connected
            operating model, AR SCMP gives you a scalable platform to do it.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="mailto:sales@arscmp.com?subject=Demo%20request"
              className="rounded-2xl px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:opacity-95"
              style={{ backgroundColor: SITE_BRAND_HEX }}
            >
              Request a Demo
            </a>
            <Link
              href="/login"
              className="rounded-2xl border-2 border-slate-200 px-10 py-5 text-xl font-bold text-slate-700 transition-all hover:bg-slate-50"
            >
              Talk to Us
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-500">
            Already exploring?{" "}
            <a href="/platform" className="font-semibold text-[#165B67] underline-offset-2 hover:underline">
              Open the platform hub
            </a>
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 md:flex-row sm:px-6 lg:px-8">
          <BrandMarkLink href="/" />
          <div className="text-sm text-slate-400">© 2026 AR SCMP. All rights reserved.</div>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-sm text-slate-400 transition-colors hover:text-[#165B67]">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-slate-400 transition-colors hover:text-[#165B67]">
              Terms
            </Link>
            <Link href="/cookies" className="text-sm text-slate-400 transition-colors hover:text-[#165B67]">
              Cookies
            </Link>
            <Link href="/login" className="text-sm text-slate-400 transition-colors hover:text-[#165B67]">
              Contact / Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
