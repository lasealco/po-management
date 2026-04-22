import { describe, expect, it } from "vitest";

import {
  TARIFF_IMPORT_ALLOWED_MIMES,
  TARIFF_IMPORT_MAX_FILE_BYTES,
  assertTariffImportMime,
  storeTariffImportFile,
} from "./store-tariff-import-file";

describe("TARIFF_IMPORT_ALLOWED_MIMES", () => {
  it("allows PDF and Excel MIME types", () => {
    expect(TARIFF_IMPORT_ALLOWED_MIMES.has("application/pdf")).toBe(true);
    expect(TARIFF_IMPORT_ALLOWED_MIMES.has("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      true,
    );
    expect(TARIFF_IMPORT_ALLOWED_MIMES.has("application/vnd.ms-excel")).toBe(true);
  });
});

describe("assertTariffImportMime", () => {
  it("accepts allowed MIME types", () => {
    expect(() => assertTariffImportMime("application/pdf")).not.toThrow();
    expect(() =>
      assertTariffImportMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ).not.toThrow();
    expect(() => assertTariffImportMime("application/vnd.ms-excel")).not.toThrow();
  });

  it("rejects unknown MIME types with a clear message", () => {
    expect(() => assertTariffImportMime("text/plain")).toThrow("Only PDF or Excel");
    expect(() => assertTariffImportMime("")).toThrow("Only PDF or Excel");
  });
});

describe("TARIFF_IMPORT_MAX_FILE_BYTES", () => {
  it("matches the documented 30 MB ceiling", () => {
    expect(TARIFF_IMPORT_MAX_FILE_BYTES).toBe(30 * 1024 * 1024);
  });
});

describe("storeTariffImportFile", () => {
  it("rejects payloads over the max size before storage", async () => {
    const bytes = Buffer.alloc(TARIFF_IMPORT_MAX_FILE_BYTES + 1);
    await expect(
      storeTariffImportFile({
        bytes,
        mimeType: "application/pdf",
        originalFileName: "big.pdf",
      }),
    ).rejects.toThrow(/30 MB/);
  });
});
