import { AccessDenied } from "@/components/access-denied";
import { SettingsCompanyLegalEntitiesClient } from "@/components/settings-company-legal-entities-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { serializeCompanyLegalEntity } from "@/lib/company-legal-entity";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsCompanyLegalEntitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ add?: string; edit?: string }>;
}) {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();
  if (!access?.user || !tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Session or tenant not available.</p>
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.settings", "view")) {
    return (
      <AccessDenied
        title="Settings"
        message="You need org.settings → view to open this page."
      />
    );
  }

  const [entities, legalOrgs, sp] = await Promise.all([
    prisma.companyLegalEntity.findMany({
      where: { tenantId: tenant.id },
      include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
      orderBy: [{ registeredLegalName: "asc" }, { id: "asc" }],
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id, kind: "LEGAL_ENTITY" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    searchParams ? searchParams : Promise.resolve({} as { add?: string; edit?: string }),
  ]);

  const initialEntities = entities.map(serializeCompanyLegalEntity);
  const canEdit = viewerHas(access.grantSet, "org.settings", "edit");
  const preselectOrgUnitId = typeof sp.add === "string" && sp.add.trim() ? sp.add.trim() : undefined;
  const preselectEditId = typeof sp.edit === "string" && sp.edit.trim() ? sp.edit.trim() : undefined;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Organization</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Legal entities</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Statutory identity per <strong>legal-entity</strong> org node (name, address, tax IDs) for
        documents and future sales / contracting flows. This is <strong>not</strong> the tenant{" "}
        <a
          className="font-medium text-[var(--arscmp-primary)] underline"
          href="/settings/organization"
        >
          Company profile
        </a>{" "}
        and is distinct from tariff <span className="whitespace-nowrap">“legal entities”</span> used
        in pricing. Create org nodes of type <strong>Legal entity / subsidiary</strong> under{" "}
        <a
          className="font-medium text-[var(--arscmp-primary)] underline"
          href="/settings/organization/structure"
        >
          Org &amp; sites
        </a>{" "}
        first, then add a legal profile here.
      </p>
      <div className="mt-8">
        <SettingsCompanyLegalEntitiesClient
          initialEntities={initialEntities}
          legalEntityOrgOptions={legalOrgs}
          canEdit={canEdit}
          preselectOrgUnitId={preselectOrgUnitId}
          preselectEditId={preselectEditId}
        />
      </div>
      {!canEdit ? (
        <p className="mt-4 text-sm text-amber-800">
          View only: grant <span className="font-medium">org.settings → edit</span> to add or change
          legal profiles.
        </p>
      ) : null}
    </div>
  );
}
