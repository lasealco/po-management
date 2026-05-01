import Link from "next/link";

import { VasIntakeClient } from "@/components/vas-intake-client";
import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { readCustomerPortalOidcEnv } from "@/lib/auth/customer-portal-oidc";
import { getViewerGrantSet, viewerHas, viewerHasWmsSectionMutationEdit } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WmsVasIntakePage() {
  const access = await getViewerGrantSet();
  const customerPortalOidcAvailable = Boolean(readCustomerPortalOidcEnv());

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="VAS intake"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
        {customerPortalOidcAvailable ? (
          <div className="mx-auto mt-4 max-w-lg px-6 text-center text-sm text-zinc-600">
            Or{" "}
            <Link
              href="/api/auth/customer-portal/oidc/start"
              className="font-semibold text-[var(--arscmp-primary)] hover:underline"
            >
              sign in with your organization (OIDC)
            </Link>
            .
          </div>
        ) : null}
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.wms", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="VAS intake" message="You do not have WMS view access." />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="VAS intake"
          message="CRM account attribution requires org.crm → view (commercial counterparty picker)."
        />
      </div>
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Tenant not found.</p>
      </div>
    );
  }

  const [warehouses, crmAccounts] = await Promise.all([
    prisma.warehouse.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.crmAccount.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 400,
    }),
  ]);

  const canSubmit = viewerHasWmsSectionMutationEdit(access.grantSet, "operations");

  const viewerRow = await prisma.user.findFirst({
    where: { id: access.user.id, tenantId: tenant.id },
    select: { customerCrmAccountId: true },
  });
  const lockedCrmAccountId = viewerRow?.customerCrmAccountId ?? null;
  const crmAccountsFiltered =
    lockedCrmAccountId != null ? crmAccounts.filter((a) => a.id === lockedCrmAccountId) : crmAccounts;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/wms" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          WMS
        </Link>
        <span className="mx-1">/</span>
        <span className="text-zinc-700">VAS intake</span>
      </nav>

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Customer-facing shell</p>
        <PageTitleWithHint title="Value-add service intake" titleClassName="text-2xl font-semibold text-zinc-900" />
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Raise warehouse-scoped work orders tied to a CRM account. Operators fulfill tasks under Operations →
          Value-add / work orders.
        </p>
      </header>

      <VasIntakeClient
        warehouses={warehouses}
        crmAccounts={crmAccountsFiltered}
        canSubmit={canSubmit}
        lockedCrmAccountId={lockedCrmAccountId}
      />
    </main>
  );
}
