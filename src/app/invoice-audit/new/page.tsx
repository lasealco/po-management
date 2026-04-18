import { InvoiceAuditNewClient } from "./invoice-audit-new-client";

export const dynamic = "force-dynamic";

export default async function InvoiceAuditNewPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await (props.searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const raw = sp.snapshotId;
  const initialSnapshotId = typeof raw === "string" ? raw.trim() : "";
  return <InvoiceAuditNewClient initialSnapshotId={initialSnapshotId} />;
}
