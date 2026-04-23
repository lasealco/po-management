/**
 * Server-only: optional branded logo for `buildControlTowerReportPdfBytes` (scheduled report emails, cron).
 * Set `CONTROL_TOWER_REPORT_PDF_LOGO_URL` to a public **https** URL for PNG or JPEG; invalid/missing = no logo.
 */
const MAX_LOGO_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;

export type ReportLogoPayload = { bytes: Uint8Array; mime: "image/png" | "image/jpeg" };

export async function loadReportPdfLogoFromEnv(): Promise<ReportLogoPayload | null> {
  const raw = process.env.CONTROL_TOWER_REPORT_PDF_LOGO_URL?.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "image/png,image/jpeg" },
    });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    if (len && Number(len) > MAX_LOGO_BYTES) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_LOGO_BYTES) return null;
    const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (ct.includes("png")) {
      return { bytes: buf, mime: "image/png" };
    }
    if (ct.includes("jpeg") || ct.includes("jpg")) {
      return { bytes: buf, mime: "image/jpeg" };
    }
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { bytes: buf, mime: "image/png" };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      return { bytes: buf, mime: "image/jpeg" };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
