import { SettingsPermissionsClient } from "@/components/settings-permissions-client";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPermissionsPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const roles = await prisma.role.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Permissions</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Choose a role, then toggle capabilities. Saved grants use effect{" "}
        <span className="font-mono text-xs">allow</span> on global rules
        (no workflow-specific row yet).
      </p>
      <div className="mt-8">
        <SettingsPermissionsClient roles={roles} />
      </div>
    </div>
  );
}
