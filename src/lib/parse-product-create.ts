const MAX_DESC = 2000;
const MAX_EAN = 32;

export type ProductDocumentInput = {
  kind: "PRIMARY_IMAGE" | "MSDS" | "OTHER";
  fileName: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type ParsedProductCreate = {
  productCode: string;
  name: string;
  description: string | null;
  sku: string | null;
  unit: string | null;
  categoryId: string | null;
  divisionId: string | null;
  ean: string | null;
  customerName: string | null;
  primaryImageUrl: string | null;
  hsCode: string | null;
  isDangerousGoods: boolean;
  dangerousGoodsClass: string | null;
  unNumber: string | null;
  properShippingName: string | null;
  packingGroup: string | null;
  flashPoint: string | null;
  flashPointUnit: string | null;
  msdsUrl: string | null;
  isTemperatureControlled: boolean;
  temperatureRangeText: string | null;
  temperatureUnit: string | null;
  coolingType: string | null;
  packagingNotes: string | null;
  humidityRequirements: string | null;
  storageDescription: string | null;
  isForReexport: boolean;
  supplierOfficeId: string | null;
  supplierIds: string[];
  documents: ProductDocumentInput[];
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function optStr(v: unknown): string | null {
  const s = str(v);
  if (s === undefined) return null;
  const t = s.trim();
  return t.length ? t : null;
}

function bool(v: unknown, defaultValue = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return defaultValue;
}

function strIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function parseProductCreateBody(
  body: unknown,
): { ok: true; data: ParsedProductCreate } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected a JSON object." };
  }

  const o = body as Record<string, unknown>;

  const productCode = optStr(o.productCode);
  if (!productCode) {
    return { ok: false, error: "productCode is required." };
  }

  const name = optStr(o.name);
  if (!name) {
    return { ok: false, error: "name is required." };
  }

  let description: string | null = null;
  if (o.description !== undefined && o.description !== null) {
    const d = str(o.description)?.trim() ?? "";
    if (d.length > MAX_DESC) {
      return {
        ok: false,
        error: `description must be at most ${MAX_DESC} characters.`,
      };
    }
    description = d.length ? d : null;
  }

  let ean: string | null = null;
  if (o.ean !== undefined && o.ean !== null) {
    const e = str(o.ean)?.trim() ?? "";
    if (e.length > MAX_EAN) {
      return { ok: false, error: `EAN must be at most ${MAX_EAN} characters.` };
    }
    ean = e.length ? e : null;
  }

  const documents: ProductDocumentInput[] = [];
  if (o.documents !== undefined && o.documents !== null) {
    if (!Array.isArray(o.documents)) {
      return { ok: false, error: "documents must be an array." };
    }
    for (const entry of o.documents) {
      if (!entry || typeof entry !== "object") continue;
      const d = entry as Record<string, unknown>;
      const kind = str(d.kind);
      if (kind !== "PRIMARY_IMAGE" && kind !== "MSDS" && kind !== "OTHER") {
        return { ok: false, error: "Invalid document kind." };
      }
      const fileName = optStr(d.fileName);
      const url = optStr(d.url);
      if (!fileName || !url) {
        return { ok: false, error: "Each document needs fileName and url." };
      }
      let sizeBytes: number | undefined;
      if (typeof d.sizeBytes === "number" && Number.isFinite(d.sizeBytes)) {
        sizeBytes = Math.floor(d.sizeBytes);
      }
      documents.push({
        kind,
        fileName,
        url,
        mimeType: optStr(d.mimeType) ?? undefined,
        sizeBytes,
      });
    }
  }

  const flashRaw = optStr(o.flashPoint);
  const data: ParsedProductCreate = {
    productCode,
    name,
    description,
    sku: optStr(o.sku),
    unit: optStr(o.unit),
    categoryId: optStr(o.categoryId),
    divisionId: optStr(o.divisionId),
    ean,
    customerName: optStr(o.customerName),
    primaryImageUrl: optStr(o.primaryImageUrl),
    hsCode: optStr(o.hsCode),
    isDangerousGoods: bool(o.isDangerousGoods),
    dangerousGoodsClass: optStr(o.dangerousGoodsClass),
    unNumber: optStr(o.unNumber),
    properShippingName: optStr(o.properShippingName),
    packingGroup: optStr(o.packingGroup),
    flashPoint: flashRaw,
    flashPointUnit: optStr(o.flashPointUnit),
    msdsUrl: optStr(o.msdsUrl),
    isTemperatureControlled: bool(o.isTemperatureControlled),
    temperatureRangeText: optStr(o.temperatureRangeText),
    temperatureUnit: optStr(o.temperatureUnit),
    coolingType: optStr(o.coolingType),
    packagingNotes: optStr(o.packagingNotes),
    humidityRequirements: optStr(o.humidityRequirements),
    storageDescription: optStr(o.storageDescription),
    isForReexport: bool(o.isForReexport),
    supplierOfficeId: optStr(o.supplierOfficeId),
    supplierIds: strIds(o.supplierIds),
    documents,
  };

  if (data.isDangerousGoods) {
    if (!data.unNumber || !data.properShippingName) {
      return {
        ok: false,
        error:
          "Dangerous goods: UN number and proper shipping name are required.",
      };
    }
  }

  if (data.isTemperatureControlled) {
    if (
      !data.temperatureRangeText ||
      !data.temperatureUnit ||
      !data.storageDescription
    ) {
      return {
        ok: false,
        error:
          "Temperature-controlled: range, unit, and storage description are required.",
      };
    }
  }

  return { ok: true, data };
}
