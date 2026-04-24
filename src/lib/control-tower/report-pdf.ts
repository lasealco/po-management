import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { REPORT_CSV_MEASURES, type ReportCsvBuildInput } from "./report-csv";
import { dimensionLabel, formatReportDateWindowLine, metricLabel } from "./report-labels";

/** Snapshot fields for a one-page (or multi-page) summary PDF — no Prisma / `report-engine` import. */
export type ControlTowerReportPdfInput = ReportCsvBuildInput & {
  title: string;
  generatedAt: string;
  shipmentsAggregated: number;
  totalShipmentsQueried: number;
  excludedByDateOrMissingDateField: number;
  /** Tenant / org name for light branding (header + footers). */
  organizationLabel?: string;
  /** Primary measure / dimension keys from report config (e.g. `shipments`, `month`) for a subtitle line. */
  reportMeasure?: string;
  reportDimension?: string;
  reportDateField?: "shippedAt" | "receivedAt" | "bookingEta";
  reportDateFrom?: string | null;
  reportDateTo?: string | null;
  /** Optional top-right mark (e.g. server-loaded PNG/JPEG from `CONTROL_TOWER_REPORT_PDF_LOGO_URL`). */
  reportLogoPngOrJpegBytes?: Uint8Array;
  reportLogoMime?: "image/png" | "image/jpeg";
};

const PAGE_W = 612;
const PAGE_H = 792;
const M = 44;
/** Phase 1B: roomier table rows + slightly larger type for scanability. */
const ROW_H = 14;
const BUCKET_W = 118;
const COL_W = 54;
const MIN_Y = M + 32;

const T_TITLE = 15;
const T_SUB = 9.5;
const T_COVERAGE = 8.5;
const T_TABLE = 8;
const T_FOOT = 7.5;
const LOGO_MAX_W = 110;
const LOGO_MAX_H = 44;
const CONTENT_MAX_W = PAGE_W - 2 * M;

const C = {
  ink: { strong: rgb(0.1, 0.11, 0.14), body: rgb(0.12, 0.14, 0.18), muted: rgb(0.3, 0.32, 0.36), light: rgb(0.44, 0.46, 0.5) },
  line: rgb(0.86, 0.88, 0.91),
  table: {
    headerFill: rgb(0.93, 0.94, 0.97),
    headerBorder: rgb(0.8, 0.83, 0.88),
    zebra: rgb(0.985, 0.988, 0.992),
  },
};

function abbrevMeasure(key: (typeof REPORT_CSV_MEASURES)[number]): string {
  switch (key) {
    case "shipments":
      return "Ship";
    case "volumeCbm":
      return "CBM";
    case "weightKg":
      return "kg";
    case "shippingSpend":
      return "$";
    case "onTimePct":
      return "OT%";
    case "avgDelayDays":
      return "Dly";
    case "openExceptions":
      return "Exc";
    case "openExceptionRatePct":
      return "Ex%";
    default:
      return key;
  }
}

function fmtCell(key: (typeof REPORT_CSV_MEASURES)[number], n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (key === "onTimePct" || key === "openExceptionRatePct") return n.toFixed(1);
  if (key === "shippingSpend") return n.toFixed(0);
  if (key === "volumeCbm") return n.toFixed(1);
  if (key === "weightKg") return n.toFixed(0);
  if (key === "avgDelayDays") return n.toFixed(1);
  if (key === "openExceptions") return String(Math.round(n));
  return String(Math.round(n));
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** UTF-8 PDF summary (tabular series + totals) for email attachment or download. */
export async function buildControlTowerReportPdfBytes(
  input: ControlTowerReportPdfInput,
): Promise<Uint8Array> {
  const dataRows = input.fullSeriesRows.length > 0 ? input.fullSeriesRows : input.rows;
  const orgLine = input.organizationLabel?.trim()
    ? truncate(input.organizationLabel.trim(), 96)
    : null;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  };

  const ensureSpace = (h: number) => {
    if (y - h < MIN_Y) newPage();
  };

  let headerTextMaxW = CONTENT_MAX_W;
  const b = input.reportLogoPngOrJpegBytes;
  const imgMime = input.reportLogoMime;
  if (b && b.length > 0 && imgMime) {
    try {
      const emb = imgMime === "image/png" ? await pdfDoc.embedPng(b) : await pdfDoc.embedJpg(b);
      const sc = Math.min(LOGO_MAX_W / emb.width, LOGO_MAX_H / emb.height, 1);
      const w = emb.width * sc;
      const h = emb.height * sc;
      const xImg = PAGE_W - M - w;
      const yImg = PAGE_H - M - h;
      page.drawImage(emb, { x: xImg, y: yImg, width: w, height: h });
      headerTextMaxW = Math.max(120, xImg - M - 8);
    } catch {
      /* bad or empty image: omit logo */
    }
  }

  const drawLine = (
    text: string,
    size: number,
    bold = false,
    color = C.ink.body,
    maxW = CONTENT_MAX_W,
  ) => {
    ensureSpace(size + 6);
    page.drawText(text.slice(0, 500), {
      x: M,
      y,
      size,
      font: bold ? fontBold : font,
      color,
      maxWidth: maxW,
    });
    y -= size + (size >= 12 ? 7 : 4);
  };

  drawLine(input.title, T_TITLE, true, C.ink.strong, headerTextMaxW);
  if (orgLine) {
    drawLine(orgLine, T_SUB, false, C.ink.muted, headerTextMaxW);
  }
  drawLine(`Generated (UTC): ${input.generatedAt}`, T_SUB, false, undefined, headerTextMaxW);
  drawLine(
    `Coverage: ${input.shipmentsAggregated} aggregated · ${input.totalShipmentsQueried} queried · ${input.excludedByDateOrMissingDateField} excluded (date / missing field)`,
    T_COVERAGE,
    false,
    undefined,
    headerTextMaxW,
  );
  const measKey = input.reportMeasure?.trim();
  const dimKey = input.reportDimension?.trim();
  if (measKey || dimKey) {
    const m = measKey ? metricLabel(measKey) : "—";
    const d = dimKey ? dimensionLabel(dimKey) : "—";
    drawLine(`${m} · ${d}`, T_SUB, false, C.ink.muted, headerTextMaxW);
  }
  const dateLine =
    input.reportDateField != null
      ? formatReportDateWindowLine({
          dateField: input.reportDateField,
          dateFrom: input.reportDateFrom ?? null,
          dateTo: input.reportDateTo ?? null,
        })
      : null;
  if (dateLine) {
    drawLine(dateLine, T_COVERAGE, false, C.ink.muted, headerTextMaxW);
  }
  y -= 2;
  page.drawLine({
    start: { x: M, y },
    end: { x: PAGE_W - M, y },
    thickness: 0.65,
    color: C.line,
  });
  y -= 8;

  type RowKind = "header" | "data" | "total";

  const drawTableRow = (cells: string[], opts: { bold: boolean; kind: RowKind; dataIndex?: number }) => {
    const { bold, kind, dataIndex = 0 } = opts;
    ensureSpace(ROW_H + 6);
    const f = bold ? fontBold : font;
    const yBaseline = y;
    const barH = ROW_H + 2;
    const barY = yBaseline - barH + 1;

    if (kind === "header") {
      page.drawRectangle({
        x: M,
        y: barY,
        width: PAGE_W - 2 * M,
        height: barH,
        color: C.table.headerFill,
        borderColor: C.table.headerBorder,
        borderWidth: 0.45,
      });
    } else if (kind === "data" && dataIndex % 2 === 1) {
      page.drawRectangle({
        x: M,
        y: barY,
        width: PAGE_W - 2 * M,
        height: barH - 1,
        color: C.table.zebra,
      });
    } else if (kind === "total") {
      page.drawLine({
        start: { x: M, y: yBaseline + 3 },
        end: { x: PAGE_W - M, y: yBaseline + 3 },
        thickness: 0.55,
        color: C.table.headerBorder,
      });
    }

    const textColor = kind === "header" ? C.ink.strong : rgb(0.08, 0.09, 0.11);
    let x = M;
    const bucket = truncate(cells[0] ?? "", 42);
    page.drawText(bucket, {
      x,
      y: yBaseline,
      size: T_TABLE,
      font: f,
      color: textColor,
      maxWidth: BUCKET_W,
    });
    x += BUCKET_W + 6;
    for (let i = 1; i < cells.length; i++) {
      const txt = cells[i] ?? "";
      const w = f.widthOfTextAtSize(txt, T_TABLE);
      page.drawText(txt, {
        x: x + COL_W - w,
        y: yBaseline,
        size: T_TABLE,
        font: f,
        color: textColor,
      });
      x += COL_W + 4;
    }
    y -= ROW_H;
    if (kind === "header") y -= 1;
  };

  drawTableRow(["Bucket", ...REPORT_CSV_MEASURES.map(abbrevMeasure)], { bold: true, kind: "header" });
  y -= 1;

  let idx = 0;
  for (const row of dataRows) {
    drawTableRow(
      [row.label, ...REPORT_CSV_MEASURES.map((m) => fmtCell(m, row.metrics[m] ?? 0))],
      { bold: false, kind: "data", dataIndex: idx },
    );
    idx += 1;
  }

  drawTableRow(
    ["TOTAL", ...REPORT_CSV_MEASURES.map((m) => fmtCell(m, input.totals[m] ?? 0))],
    { bold: true, kind: "total" },
  );

  y -= 8;
  const footerTagline = orgLine
    ? `${orgLine} · Control Tower — report snapshot (full series in CSV when attached).`
    : "Control Tower — report snapshot (full series in CSV when attached).";
  drawLine(footerTagline, T_FOOT, false, C.ink.light);

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    pg.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: PAGE_W - M - 72,
      y: 22,
      size: T_FOOT,
      font,
      color: rgb(0.55, 0.57, 0.6),
    });
    if (orgLine) {
      pg.drawText(truncate(orgLine, 44), {
        x: M,
        y: 22,
        size: T_FOOT,
        font,
        color: rgb(0.55, 0.57, 0.6),
        maxWidth: PAGE_W - 2 * M - 88,
      });
    }
  }

  return pdfDoc.save();
}
