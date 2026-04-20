/**
 * Human-readable report measure / dimension labels (shared by PDF, CSV, charts, email).
 * Keep free of React so server routes can import safely.
 */

export function metricLabel(measure: string): string {
  if (measure === "onTimePct") return "On-time %";
  if (measure === "shippingSpend") return "Shipping spend (est.)";
  if (measure === "avgDelayDays") return "Avg delay (days)";
  if (measure === "volumeCbm") return "Volume (CBM)";
  if (measure === "weightKg") return "Weight (kg)";
  if (measure === "openExceptions") return "Open exceptions (count)";
  return "Shipments";
}

export function dimensionLabel(dimension: string): string {
  if (dimension === "lane") return "Lane (origin → destination)";
  if (dimension === "carrier") return "Carrier / forwarder";
  if (dimension === "customer") return "Customer";
  if (dimension === "supplier") return "Supplier (PO)";
  if (dimension === "origin") return "Origin";
  if (dimension === "destination") return "Destination";
  if (dimension === "month") return "Month";
  if (dimension === "mode") return "Mode";
  if (dimension === "status") return "Status";
  if (dimension === "none") return "All";
  if (dimension === "exceptionCatalog") return "Exception catalog (code)";
  return "Category";
}

export function dateFieldLabel(field: string): string {
  if (field === "shippedAt") return "Ship date";
  if (field === "receivedAt") return "Received date";
  if (field === "bookingEta") return "Booking ETA";
  return field;
}

function shortenDateParam(raw: string): string {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}

/** One line for PDF / email when `dateFrom` / `dateTo` were set on the report. */
export function formatReportDateWindowLine(params: {
  dateField: "shippedAt" | "receivedAt" | "bookingEta";
  dateFrom: string | null;
  dateTo: string | null;
}): string | null {
  const from = params.dateFrom?.trim() ? shortenDateParam(params.dateFrom) : null;
  const to = params.dateTo?.trim() ? shortenDateParam(params.dateTo) : null;
  if (!from && !to) return null;
  const lab = dateFieldLabel(params.dateField);
  if (from && to) return `Date window (${lab}, UTC): ${from} … ${to}`;
  if (from) return `Date window (${lab}, UTC): from ${from}`;
  return `Date window (${lab}, UTC): until ${to}`;
}
