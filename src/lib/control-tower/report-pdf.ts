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
};

const PAGE_W = 612;
const PAGE_H = 792;
const M = 44;
const ROW_H = 12;
const TABLE_FONT = 7;
const BUCKET_W = 118;
const COL_W = 54;
const MIN_Y = M + 28;

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
    default:
      return key;
  }
}

function fmtCell(key: (typeof REPORT_CSV_MEASURES)[number], n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (key === "onTimePct") return n.toFixed(1);
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

  const drawLine = (text: string, size: number, bold = false, color = rgb(0.12, 0.14, 0.18)) => {
    ensureSpace(size + 6);
    page.drawText(text.slice(0, 500), {
      x: M,
      y,
      size,
      font: bold ? fontBold : font,
      color,
      maxWidth: PAGE_W - 2 * M,
    });
    y -= size + (size >= 11 ? 6 : 4);
  };

  drawLine(input.title, 13, true);
  if (orgLine) {
    drawLine(orgLine, 9, false, rgb(0.32, 0.34, 0.38));
  }
  drawLine(`Generated (UTC): ${input.generatedAt}`, 9);
  drawLine(
    `Coverage: ${input.shipmentsAggregated} aggregated · ${input.totalShipmentsQueried} queried · ${input.excludedByDateOrMissingDateField} excluded (date / missing field)`,
    8,
  );
  const measKey = input.reportMeasure?.trim();
  const dimKey = input.reportDimension?.trim();
  if (measKey || dimKey) {
    const m = measKey ? metricLabel(measKey) : "—";
    const d = dimKey ? dimensionLabel(dimKey) : "—";
    drawLine(`${m} · ${d}`, 9, false, rgb(0.28, 0.3, 0.34));
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
    drawLine(dateLine, 8, false, rgb(0.28, 0.3, 0.34));
  }
  y -= 4;

  const drawTableRow = (cells: string[], bold: boolean) => {
    ensureSpace(ROW_H + 4);
    const f = bold ? fontBold : font;
    let x = M;
    const bucket = truncate(cells[0] ?? "", 42);
    page.drawText(bucket, {
      x,
      y,
      size: TABLE_FONT,
      font: f,
      color: rgb(0.08, 0.09, 0.11),
      maxWidth: BUCKET_W,
    });
    x += BUCKET_W + 6;
    for (let i = 1; i < cells.length; i++) {
      const txt = cells[i] ?? "";
      const w = f.widthOfTextAtSize(txt, TABLE_FONT);
      page.drawText(txt, {
        x: x + COL_W - w,
        y,
        size: TABLE_FONT,
        font: f,
        color: rgb(0.08, 0.09, 0.11),
      });
      x += COL_W + 4;
    }
    y -= ROW_H;
  };

  drawTableRow(["Bucket", ...REPORT_CSV_MEASURES.map(abbrevMeasure)], true);
  y -= 2;

  for (const row of dataRows) {
    drawTableRow(
      [row.label, ...REPORT_CSV_MEASURES.map((m) => fmtCell(m, row.metrics[m] ?? 0))],
      false,
    );
  }

  drawTableRow(
    ["TOTAL", ...REPORT_CSV_MEASURES.map((m) => fmtCell(m, input.totals[m] ?? 0))],
    true,
  );

  y -= 6;
  const footerTagline = orgLine
    ? `${orgLine} · Control Tower — report snapshot (full series in CSV when attached).`
    : "Control Tower — report snapshot (full series in CSV when attached).";
  drawLine(footerTagline, 7, false, rgb(0.42, 0.44, 0.48));

  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i];
    pg.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: PAGE_W - M - 72,
      y: 22,
      size: 7,
      font,
      color: rgb(0.55, 0.57, 0.6),
    });
    if (orgLine) {
      pg.drawText(truncate(orgLine, 44), {
        x: M,
        y: 22,
        size: 7,
        font,
        color: rgb(0.55, 0.57, 0.6),
        maxWidth: PAGE_W - 2 * M - 88,
      });
    }
  }

  return pdfDoc.save();
}
