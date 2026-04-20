import { SettingsReferenceDataClient } from "@/components/settings-reference-data-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsReferenceDataPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.settings", "edit"));

  let counts = { countries: 0, oceanCarriers: 0, airlines: 0 };
  let catalogError: string | null = null;
  try {
    const [countries, oceanCarriers, airlines] = await Promise.all([
      prisma.referenceCountry.count(),
      prisma.referenceOceanCarrier.count(),
      prisma.referenceAirline.count(),
    ]);
    counts = { countries, oceanCarriers, airlines };
  } catch {
    catalogError =
      "Reference catalog tables are missing or the database is out of date. Run `npx prisma migrate deploy` (or `db:migrate:local`), then `npm run db:seed`.";
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Reference data</h2>
      <p className="mt-1 text-sm text-zinc-600">
        ISO countries, ocean SCAC identifiers, and airline IATA / AWB prefixes — shared across tariffs, logistics, and
        transport UIs.
      </p>
      {catalogError ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{catalogError}</p>
      ) : (
        <div className="mt-8">
          <SettingsReferenceDataClient canEdit={canEdit} initialCounts={counts} />
        </div>
      )}
    </div>
  );
}
