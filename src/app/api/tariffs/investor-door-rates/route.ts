import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { lookupInvestorDehamUschiDoorRates } from "@/lib/tariff/investor-door-rate-lookup";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

/**
 * Investor demo: two pre-seeded door-to-door stacks (DEHAM ↔ USCHI, 40' HC) for side-by-side comparison.
 * Requires seed: `npm run db:seed:tariff-deham-uschi-investor-demo`
 */
export async function GET() {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  try {
    const payload = await lookupInvestorDehamUschiDoorRates({ tenantId: tenant.id });
    return NextResponse.json({
      ...payload,
      missingSeed: payload.options.length === 0,
      hint:
        payload.options.length === 0
          ? "Run `npm run db:seed:tariff-deham-uschi-investor-demo` after migrate + `npm run db:seed`."
          : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed." },
      { status: 500 },
    );
  }
}
