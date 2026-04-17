import { AccessDenied } from "@/components/access-denied";
import { SettingsCtExceptionCodesClient } from "@/components/settings-ct-exception-codes-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsControlTowerExceptionCodesPage() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();

  if (!access?.user || !tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Session or tenant not available.</p>
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.controltower", "view")) {
    return (
      <AccessDenied
        title="Control Tower exception types"
        message="You need org.controltower → view to manage the exception type catalog."
      />
    );
  }

  const codes = await prisma.ctExceptionCode.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      label: true,
      defaultSeverity: true,
      sortOrder: true,
      isActive: true,
    },
  });

  const initialCodes = codes.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
    defaultSeverity: c.defaultSeverity,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  }));

  const canEdit = viewerHas(access.grantSet, "org.controltower", "edit");

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Control Tower — exception types</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Tenant catalog for exception records in Shipment 360. Aligns with the alert/exception catalog in the Control
        Tower specification pack.
      </p>
      <div className="mt-8">
        <SettingsCtExceptionCodesClient initialCodes={initialCodes} canEdit={canEdit} />
      </div>
      {!canEdit ? (
        <p className="mt-4 text-sm text-amber-800">
          View only: grant <span className="font-medium">org.controltower → edit</span> to add or change types.
        </p>
      ) : null}
    </div>
  );
}
