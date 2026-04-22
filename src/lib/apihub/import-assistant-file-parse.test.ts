import { describe, expect, it } from "vitest";

import {
  parseImportAssistantCsvText,
  parseImportAssistantFileByName,
  parseImportAssistantJsonText,
} from "./import-assistant-file-parse";

describe("parseImportAssistantJsonText", () => {
  it("accepts array of objects", () => {
    const r = parseImportAssistantJsonText('[{"a":1},{"a":2}]');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.records).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("wraps single object", () => {
    const r = parseImportAssistantJsonText('{"x":true}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.records).toEqual([{ x: true }]);
  });

  it("rejects non-objects in array", () => {
    const r = parseImportAssistantJsonText("[1,2]");
    expect(r.ok).toBe(false);
  });
});

describe("parseImportAssistantCsvText", () => {
  it("builds objects from header row", () => {
    const r = parseImportAssistantCsvText("id,name\na,Alpha\nb,Beta");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.records).toEqual([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ]);
  });
});

describe("parseImportAssistantFileByName", () => {
  it("dispatches by extension", () => {
    const j = parseImportAssistantFileByName("x.json", "[{}]");
    expect(j.ok).toBe(true);
    const c = parseImportAssistantFileByName("x.csv", "a,b\n1,2");
    expect(c.ok).toBe(true);
    const x = parseImportAssistantFileByName("x.xml", "<a/>");
    expect(x.ok).toBe(false);
  });
});
