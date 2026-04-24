import type { SerializedCompanyLegalEntity } from "@/lib/company-legal-entity";
import Link from "next/link";

/**
 * Read-only block: statutory “order-for” legal profile when a `CompanyLegalEntity` row exists
 * for the same org as the SO’s `servedOrgUnit`.
 */
export function SalesOrderCompanyLegalSnapshot({
  servedOrg,
  companyLegal,
  canViewSettings,
}: {
  servedOrg: { id: string; name: string; code: string; kind: string } | null;
  companyLegal: SerializedCompanyLegalEntity | null;
  /** When true, show link to add/edit under Settings. */
  canViewSettings: boolean;
}) {
  if (!servedOrg) {
    return (
      <p className="text-xs text-zinc-500">
        Select an <strong>Order for</strong> org to attach statutory identity for documents when a legal profile
        exists for that org.
      </p>
    );
  }

  if (companyLegal) {
    const parts = [
      companyLegal.addressLine1,
      companyLegal.addressLine2,
      [companyLegal.addressPostalCode, companyLegal.addressCity].filter(Boolean).join(" "),
      companyLegal.addressRegion,
      companyLegal.addressCountryCode,
    ].filter(Boolean) as string[];
    return (
      <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-sm text-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Selling / order-for (legal)</p>
        <p className="mt-1 font-medium">{companyLegal.registeredLegalName}</p>
        {companyLegal.tradeName ? <p className="text-xs text-zinc-600">Trade: {companyLegal.tradeName}</p> : null}
        {companyLegal.taxVatId || companyLegal.taxLocalId ? (
          <p className="mt-1 text-xs text-zinc-700">
            {companyLegal.taxVatId ? <span className="mr-3">VAT: {companyLegal.taxVatId}</span> : null}
            {companyLegal.taxLocalId ? <span>Local tax: {companyLegal.taxLocalId}</span> : null}
          </p>
        ) : null}
        {parts.length > 0 ? (
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-700">{parts.join("\n")}</p>
        ) : null}
        {companyLegal.status !== "ACTIVE" ? (
          <p className="mt-2 text-xs text-amber-800">Status: {companyLegal.status}</p>
        ) : null}
        {canViewSettings ? (
          <p className="mt-2 text-xs text-zinc-500">
            <Link
              className="font-medium text-[var(--arscmp-primary)] underline"
              href="/settings/organization/legal-entities"
            >
              Legal entities (settings)
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  if (servedOrg.kind === "LEGAL_ENTITY") {
    return (
      <p className="text-xs text-amber-900">
        No statutory profile is set for <strong>{servedOrg.name}</strong> yet. Add one under{" "}
        {canViewSettings ? (
          <Link
            className="font-medium text-[var(--arscmp-primary)] underline"
            href={`/settings/organization/legal-entities?add=${servedOrg.id}`}
          >
            Settings → Legal entities
          </Link>
        ) : (
          "Settings → Legal entities"
        )}
        , or use the link from <strong>Org &amp; sites</strong> for this org unit.
        <span className="ml-1 inline-block">— the SO still uses the org for “order for” scoping.</span>
      </p>
    );
  }

  return (
    <p className="text-xs text-zinc-500">
      Statutory legal blocks apply when <strong>Order for</strong> is a <strong>Legal entity / subsidiary</strong> org
      with a row in{" "}
      {canViewSettings ? (
        <Link className="font-medium text-[var(--arscmp-primary)] underline" href="/settings/organization/legal-entities">
          Legal entities
        </Link>
      ) : (
        "Legal entities"
      )}
      . Current org type: {servedOrg.kind}.
    </p>
  );
}
