import { TariffGeographyType } from "@prisma/client";

import { GeographyGroupFormClient, type GeographyGroupFormValues } from "@/components/tariffs/geography-group-form-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

const initial: GeographyGroupFormValues = {
  geographyType: TariffGeographyType.SUBREGION,
  name: "",
  code: "",
  aliasSource: "",
  validFrom: "",
  validTo: "",
  active: true,
};

export default async function NewTariffGeographyGroupPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1 of 2</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">New geography group</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Choose the group type (subregion, country, port cluster, alias group, etc.), then add members on the next
          screen.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You have view-only access. Ask an administrator for <span className="font-medium">org.tariffs → edit</span>{" "}
            to create groups.
          </p>
        ) : null}

        <div className="mt-8">
          <GeographyGroupFormClient mode="create" canEdit={canEdit} initial={initial} />
        </div>
      </section>
    </main>
  );
}
