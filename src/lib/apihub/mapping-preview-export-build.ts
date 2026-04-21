import type { MappingPreviewComputedRow, MappingPreviewSamplingMeta } from "@/lib/apihub/mapping-preview-run";

export type MappingPreviewIssuesExportJson = {
  runId: string;
  generatedAt: string;
  sampling: MappingPreviewSamplingMeta;
  preview: MappingPreviewComputedRow[];
};

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildMappingPreviewIssuesJson(payload: MappingPreviewIssuesExportJson): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** One CSV row per mapping issue; includes a marker row when there are zero issues. */
export function buildMappingPreviewIssuesCsv(rows: MappingPreviewComputedRow[]): string {
  const header = "recordIndex,field,code,severity,message";
  const lines = [header];
  let issueCount = 0;
  for (const row of rows) {
    for (const issue of row.issues) {
      issueCount += 1;
      const sev = issue.severity ?? "error";
      const cells = [
        String(row.recordIndex),
        issue.field,
        issue.code,
        sev,
        issue.message,
      ].map(escapeCsvCell);
      lines.push(cells.join(","));
    }
  }
  if (issueCount === 0) {
    lines.push(["", "", "", "info", "No mapping issues in the previewed records."].map(escapeCsvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
