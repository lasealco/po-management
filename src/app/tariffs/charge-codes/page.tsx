import Link from "next/link";

import { TariffChargeCodesClient } from "@/app/tariffs/charge-codes/tariff-charge-codes-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listNormalizedChargeCodes } from "@/lib/tariff/normalized-charge-codes";

export const dynamic = "force-dynamic";

export default async function TariffChargeCodesPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));
  const rows = await listNormalizedChargeCodes();
  const initialRows = rows.map((r) => ({
    id: r.id,
    code: r.code,
    displayName: r.displayName,
    chargeFamily: r.chargeFamily,
    transportMode: r.transportMode,
    isLocalCharge: r.isLocalCharge,
    isSurcharge: r.isSurcharge,
    active: r.active,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link href="/tariffs/contracts" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Charge codes</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Maintain the normalized charge taxonomy used on contract charge lines and in frozen snapshots.
        </p>
      </div>
      <TariffChargeCodesClient initialRows={initialRows} canEdit={canEdit} />
    </main>
  );
}
