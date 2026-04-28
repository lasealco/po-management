import { GET } from "@/app/api/rfq/procurement/route";

import { TransportationProcurementClient } from "./transportation-procurement-client";

export const dynamic = "force-dynamic";

export default async function TransportationProcurementPage() {
  const response = await GET();
  const snapshot = await response.json();
  return <TransportationProcurementClient initialSnapshot={snapshot} />;
}
