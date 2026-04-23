import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { SrmNotificationsHeaderLink } from "@/components/srm/srm-notifications-header-link";
import { SupplierCreateForm } from "@/components/supplier-create-form";
import { getViewerGrantSet } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { resolveSrmPermissions } from "@/lib/srm/permissions";

export const dynamic = "force-dynamic";

function parseKind(raw: string | string[] | undefined): "product" | "logistics" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "logistics" ? "logistics" : "product";
}

export default async function SrmNewSupplierPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const kind = parseKind(sp.kind);
  const access = await getViewerGrantSet();

  if (!access || !access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create partner"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  const permissions = resolveSrmPermissions(access.grantSet);

  if (!permissions.canEditSuppliers) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create partner"
          message="You do not have permission to create supplier master data (org.suppliers → edit)."
        />
      </div>
    );
  }

  const { tenant, user } = access;
  const unreadSrmNotifications = permissions.canViewSuppliers
    ? await prisma.srmOperatorNotification.count({
        where: { tenantId: tenant.id, userId: user.id, readAt: null },
      })
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            <Link
              href={`/srm?kind=${kind}`}
              className="font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              ← Back to SRM {kind === "logistics" ? "logistics" : "product"} partners
            </Link>
          </p>
          {permissions.canViewSuppliers ? <SrmNotificationsHeaderLink unreadCount={unreadSrmNotifications} /> : null}
        </div>
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <SupplierCreateForm defaultSrmCategory={kind} inPageShell />
        </section>
      </main>
    </div>
  );
}
