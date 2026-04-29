/**
 * Minimal ZPL (^XA/^XZ) ship-station label stub for thermal printers (BF-08).
 * Operators download `.zpl` and send to a printer queue or middleware — no in-browser printer driver.
 */

/** Restrict payload to safe ASCII for ^FD fields (avoid breaking ZPL tokens). */
export function sanitizeZplFdLine(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length <= maxLen ? cleaned : `${cleaned.slice(0, Math.max(0, maxLen - 1))}…`;
}

export type ShipStationZplInput = {
  outboundNo: string;
  warehouseLabel: string;
  /** Encoded in Code 128 (e.g. outbound number or SSCC). */
  barcodePayload: string;
  shipToSummary: string;
  asnReference: string | null;
  /** When present, printed as human-readable SSCC line (18 digits). */
  sscc18: string | null;
};

export function buildShipStationZpl(input: ShipStationZplInput): string {
  const title = sanitizeZplFdLine(`OUT ${input.outboundNo}`, 40);
  const wh = sanitizeZplFdLine(input.warehouseLabel, 48);
  const ship = sanitizeZplFdLine(input.shipToSummary, 56);
  const asn = input.asnReference ? sanitizeZplFdLine(`ASN ${input.asnReference}`, 56) : "";
  const ssccLine = input.sscc18 ? sanitizeZplFdLine(`SSCC ${input.sscc18}`, 48) : "";
  const barcode = sanitizeZplFdLine(input.barcodePayload.replace(/[^\x20-\x7E]/g, ""), 48);

  const lines: string[] = [
    "^XA",
    "^LH0,0",
    "^PW812",
    "^LL812",
    "^FX BF-08 ship-station ZPL stub",
    "^CF0,28",
  ];
  let y = 32;
  const dy = 34;
  lines.push(`^FO32,${y}`, `^FD${title}^FS`);
  y += dy;
  lines.push(`^FO32,${y}`, `^FD${wh}^FS`);
  y += dy;
  lines.push(`^FO32,${y}`, `^FD${ship}^FS`);
  y += dy;
  if (asn) {
    lines.push(`^FO32,${y}`, `^FD${asn}^FS`);
    y += dy;
  }
  if (ssccLine) {
    lines.push(`^FO32,${y}`, `^FD${ssccLine}^FS`);
    y += dy;
  }
  y += 6;
  lines.push(`^FO32,${y}`, "^BCN,72,Y,N,N,N", `^FD${barcode}^FS`, "^XZ");
  return `${lines.join("\r\n")}\r\n`;
}

/** Browser-only: downloads UTF-8 `.zpl` for manual send to printer / integration. */
export function downloadZplTextFile(zplBody: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([zplBody], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
