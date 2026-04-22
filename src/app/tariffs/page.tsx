import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  TARIFF_CHARGE_CODES_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_GEOGRAPHY_PATH,
  TARIFF_IMPORT_NEW_PATH,
  TARIFF_IMPORT_PATH,
  TARIFF_LEGAL_ENTITIES_PATH,
  TARIFF_NEW_CONTRACT_PATH,
  TARIFF_PROVIDERS_PATH,
  TARIFF_RATE_LOOKUP_PATH,
  tariffLaneRatingPath,
} from "@/lib/tariff/tariff-workbench-urls";

export const dynamic = "force-dynamic";

type WorkflowStep = {
  title: string;
  description: string;
  href: string;
  cta: string;
  emphasize?: boolean;
};

export default async function TariffsOverviewPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto w-full max-w-7xl py-12 pl-2 pr-6 sm:pl-3 md:pl-6">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const workflowSteps: WorkflowStep[] = [
    {
      title: "Step 1 — Reference data",
      description:
        "Providers, legal entities, geography groups, and normalized charge codes underpin every published contract.",
      href: TARIFF_PROVIDERS_PATH,
      cta: "Open providers",
    },
    {
      title: "Step 2 — Contracts & versions",
      description: "Create headers, publish versions, and maintain rate lines, surcharges, and free time rules.",
      href: TARIFF_CONTRACTS_DIRECTORY_PATH,
      cta: "Browse contracts",
      emphasize: true,
    },
    {
      title: "Step 3 — Rate lookup & rating",
      description: "Validate door-style totals for stakeholders and explore lane rating with optional shipment context.",
      href: TARIFF_RATE_LOOKUP_PATH,
      cta: "Open rate lookup",
    },
  ];

  const workAreas: { title: string; href: string; blurb: string }[] = [
    { title: "Rate lookup", href: TARIFF_RATE_LOOKUP_PATH, blurb: "Investor and demo-friendly totals." },
    { title: "Rating", href: tariffLaneRatingPath(), blurb: "Lane explorer; optional shipment query param." },
    { title: "Contracts", href: TARIFF_CONTRACTS_DIRECTORY_PATH, blurb: "Headers, versions, and workbench." },
    { title: "Import", href: TARIFF_IMPORT_PATH, blurb: "Uploads, staging review, promote to versions." },
    { title: "Geography", href: TARIFF_GEOGRAPHY_PATH, blurb: "Groups and members for lanes and locations." },
    { title: "Providers", href: TARIFF_PROVIDERS_PATH, blurb: "Carriers and similar identities." },
    { title: "Legal entities", href: TARIFF_LEGAL_ENTITIES_PATH, blurb: "Contracting and bill-to parties." },
    { title: "Charge codes", href: TARIFF_CHARGE_CODES_PATH, blurb: "Shared normalized surcharge codes." },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl py-10 pl-2 pr-6 sm:pl-3 md:pl-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Tariffs & rates</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Reference data, contracts, imports, and rating in one workbench. Follow the steps for the usual path; use
              All areas or the bar above to jump anywhere.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={TARIFF_NEW_CONTRACT_PATH}
                className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
              >
                New contract
              </Link>
              <Link
                href={TARIFF_IMPORT_NEW_PATH}
                className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
              >
                New import
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step) => (
            <div
              key={step.href}
              className={`rounded-2xl border p-5 shadow-sm ${
                step.emphasize ? "border-[var(--arscmp-primary)]/35 bg-zinc-50/80" : "border-zinc-200 bg-white"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{step.title}</p>
              <p className="mt-3 text-sm text-zinc-600">{step.description}</p>
              <Link
                href={step.href}
                className={`mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${
                  step.emphasize
                    ? "bg-[var(--arscmp-primary)] text-white hover:brightness-95"
                    : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                }`}
              >
                {step.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Directory</p>
        <h2 className="mt-3 text-lg font-semibold text-zinc-900">All areas</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workAreas.map((a) => (
            <li key={a.title}>
              <Link
                href={a.href}
                className="block rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 shadow-sm hover:border-zinc-300 hover:bg-white"
              >
                <span className="font-medium text-zinc-900">{a.title}</span>
                <span className="mt-1 block text-xs text-zinc-600">{a.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
