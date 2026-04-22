/**
 * Parse user files for the import assistant (JSON, CSV). XML is handled in the browser (DOMParser).
 */

export type ImportAssistantFileParseOk = { ok: true; records: unknown[]; format: "json" | "csv" };
export type ImportAssistantFileParseErr = { ok: false; message: string };
export type ImportAssistantFileParseResult = ImportAssistantFileParseOk | ImportAssistantFileParseErr;

function normalizeRecordsArray(records: unknown[]): ImportAssistantFileParseOk | ImportAssistantFileParseErr {
  let nonObjectCount = 0;
  for (const item of records) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      nonObjectCount += 1;
    }
  }
  if (nonObjectCount > 0) {
    return {
      ok: false,
      message: `Every record must be a plain object. ${nonObjectCount} entr${nonObjectCount === 1 ? "y is" : "ies are"} not objects.`,
    };
  }
  return { ok: true, records, format: "json" };
}

export function parseImportAssistantJsonText(text: string): ImportAssistantFileParseResult {
  const t = text.trim();
  if (!t) {
    return { ok: false, message: "File is empty." };
  }
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    return { ok: false, message: "Could not read this as JSON. Check the file or try CSV/XML." };
  }
  if (Array.isArray(v)) {
    return normalizeRecordsArray(v);
  }
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return { ok: true, records: [v], format: "json" };
  }
  return { ok: false, message: "JSON must be an object or an array of objects." };
}

/** Minimal CSV: first row = headers, comma-separated; quoted fields not supported in v1. */
export function parseImportAssistantCsvText(text: string): ImportAssistantFileParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { ok: false, message: "CSV needs a header row and at least one data row." };
  }
  const splitRow = (line: string): string[] => line.split(",").map((c) => c.trim());
  const headers = splitRow(lines[0]!);
  if (headers.some((h) => !h)) {
    return { ok: false, message: "CSV headers must all be non-empty for this importer." };
  }
  const records: unknown[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = cells[c] ?? "";
    }
    records.push(row);
  }
  return { ok: true, records, format: "csv" };
}

export function parseImportAssistantFileByName(
  name: string,
  text: string,
): ImportAssistantFileParseResult {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) {
    return parseImportAssistantJsonText(text);
  }
  if (lower.endsWith(".csv")) {
    return parseImportAssistantCsvText(text);
  }
  return { ok: false, message: "Unsupported extension. Use .json, .csv, or .xml (handled in the browser)." };
}
