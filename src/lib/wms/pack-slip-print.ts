/** Minimal HTML escape for pack-slip content embedded in print HTML. */
export function escapeHtmlForPackSlip(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PackSlipLineInput = {
  lineNo: number;
  productCode: string | null;
  sku: string | null;
  name: string;
  quantity: string;
  pickedQty: string;
  packedQty: string;
};

export type PackSlipOrderInput = {
  outboundNo: string;
  warehouseLabel: string;
  customerRef: string | null;
  asnReference: string | null;
  requestedShipDate: string | null;
  shipToName: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  status: string;
  lines: PackSlipLineInput[];
  /** When set (BF-08), printed as human-readable GS1 SSCC-18 for integrations / scanner trials. */
  sscc18HumanReadable?: string | null;
};

/** Opens a printable pack-slip window (browser only). */
export function printOutboundPackSlip(order: PackSlipOrderInput): void {
  if (typeof window === "undefined") return;

  const rows = order.lines
    .map((l) => {
      const sku = l.productCode || l.sku || "";
      return `<tr>
        <td>${l.lineNo}</td>
        <td>${escapeHtmlForPackSlip(sku)}</td>
        <td>${escapeHtmlForPackSlip(l.name)}</td>
        <td class="num">${escapeHtmlForPackSlip(l.quantity)}</td>
        <td class="num">${escapeHtmlForPackSlip(l.pickedQty)}</td>
        <td class="num">${escapeHtmlForPackSlip(l.packedQty)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pack slip ${escapeHtmlForPackSlip(order.outboundNo)}</title>
<style>
 body{font-family:system-ui,sans-serif;padding:16px;color:#18181b;}
 h1{font-size:18px;margin:0 0 4px;}
 .muted{color:#71717a;font-size:12px;}
 table{border-collapse:collapse;width:100%;margin-top:12px;font-size:13px;}
 th,td{border:1px solid #e4e4e7;padding:6px 8px;text-align:left;}
 th{background:#f4f4f5;}
 .num{text-align:right;font-variant-numeric:tabular-nums;}
 @media print{button{display:none}}
</style></head><body>
<h1>Pack slip · ${escapeHtmlForPackSlip(order.outboundNo)}</h1>
<p class="muted">${escapeHtmlForPackSlip(order.warehouseLabel)} · Status ${escapeHtmlForPackSlip(order.status)}</p>
<p><strong>Ship to:</strong> ${escapeHtmlForPackSlip(order.shipToName ?? "—")}${order.shipToCity ? ` · ${escapeHtmlForPackSlip(order.shipToCity)}` : ""}${order.shipToCountryCode ? ` · ${escapeHtmlForPackSlip(order.shipToCountryCode)}` : ""}</p>
<p><strong>Customer ref:</strong> ${escapeHtmlForPackSlip(order.customerRef ?? "—")} · <strong>ASN:</strong> ${escapeHtmlForPackSlip(order.asnReference ?? "—")}</p>
<p><strong>Requested ship:</strong> ${order.requestedShipDate ? escapeHtmlForPackSlip(new Date(order.requestedShipDate).toLocaleString()) : "—"}</p>
${
    order.sscc18HumanReadable
      ? `<p><strong>SSCC (demo):</strong> ${escapeHtmlForPackSlip(order.sscc18HumanReadable)}</p>`
      : ""
  }
<table>
<thead><tr><th>#</th><th>SKU / code</th><th>Description</th><th class="num">Order qty</th><th class="num">Picked</th><th class="num">Packed</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="muted" style="margin-top:16px">Printed ${escapeHtmlForPackSlip(new Date().toISOString().slice(0, 19).replace("T", " "))} UTC</p>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
