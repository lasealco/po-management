import { SettingsOrgStructureClient } from "@/components/settings-org-structure-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildOrgUnitTree } from "@/lib/org-unit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsOrgStructurePage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const [access, orgUnits, referenceCountries] = await Promise.all([
    getViewerGrantSet(),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.referenceCountry.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { isoAlpha2: true, name: true },
    }),
  ]);

  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.settings", "edit"),
  );

  const tree = buildOrgUnitTree(
    orgUnits.map((o) => ({
      id: o.id,
      parentId: o.parentId,
      name: o.name,
      code: o.code,
      kind: o.kind,
      sortOrder: o.sortOrder,
    })),
  );

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Organization</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Org & sites</h2>
      <p className="mt-1 text-sm text-zinc-600">
        The company name you see in the app (e.g. demo tenant) is <strong>not</strong> an org unit:
        the tree is <strong>under</strong> the tenant, and <span className="whitespace-nowrap">“Top level (no parent)”</span> means
        a root node with no parent. Build your <strong>geographic / legal hierarchy</strong> (group →
        region → country → site).{" "}
        <strong>Legal / billing address</strong> for the company lives under Settings →{" "}
        <a href="/settings/organization" className="font-medium text-[var(--arscmp-primary)] underline">
          Company profile
        </a>
        — org units here are for structure and assignment only. Assign each user a <strong>primary org</strong> and optional{" "}
        <strong>product division</strong> scope under Settings → Users. Permissions (roles) stay
        tenant-wide; row-level scoping from org is a future phase.
      </p>
      <div className="mt-8">
        <SettingsOrgStructureClient
          canEdit={canEdit}
          initialTree={tree}
          allFlat={orgUnits.map((o) => ({
            id: o.id,
            parentId: o.parentId,
            name: o.name,
            code: o.code,
            kind: o.kind,
            sortOrder: o.sortOrder,
          }))}
          referenceCountries={referenceCountries}
        />
      </div>
    </div>
  );
}
