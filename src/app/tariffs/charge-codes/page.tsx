import Link from "next/link";

import { TariffChargeCodesClient } from "@/app/tariffs/charge-codes/tariff-charge-codes-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffAuditLogsByObjectType } from "@/lib/tariff/audit-log";
import { listNormalizedChargeCodes, toChargeCatalogRowJson } from "@/lib/tariff/normalized-charge-codes";
import { TARIFF_CONTRACTS_DIRECTORY_PATH } from "@/lib/tariff/tariff-workbench-urls";

export const dynamic = "force-dynamic";

export default async function TariffChargeCodesPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));
  const [rows, auditLogs] = await Promise.all([
    listNormalizedChargeCodes(),
    listTariffAuditLogsByObjectType({ objectType: "normalized_charge_code", take: 30 }),
  ]);
  const initialRows = rows.map(toChargeCatalogRowJson);
  const auditTail = auditLogs.map((a) => ({
    id: a.id,
    action: a.action,
    objectId: a.objectId,
    at: a.createdAt.toISOString(),
    actor: a.user?.name ?? a.user?.email ?? "—",
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link href={TARIFF_CONTRACTS_DIRECTORY_PATH} className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Charge codes</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Maintain the normalized charge taxonomy used on contract charge lines and in frozen snapshots.
        </p>
      </div>
      <TariffChargeCodesClient initialRows={initialRows} auditTail={auditTail} canEdit={canEdit} />
    </main>
  );
}
