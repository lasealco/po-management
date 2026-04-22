import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { logApiHubBackgroundError } from "./safe-server-log";

/**
 * P4 — discourage logging request surfaces that often carry secrets (headers, cookies).
 * Only `safe-server-log.ts` may use console.* for ApiHub background errors in lib; routes should
 * use `logApiHubBackgroundError`.
 */
const APIHUB_HTTP_ROOT = path.join(process.cwd(), "src/app/api/apihub");
const APIHUB_LIB_ROOT = path.join(process.cwd(), "src/lib/apihub");

const CONSOLE_METHOD = /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/;

function collectTsFiles(dir: string, opts: { skipTest: boolean }): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...collectTsFiles(p, opts));
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      if (opts.skipTest && ent.name.endsWith(".test.ts")) continue;
      out.push(p);
    }
  }
  return out;
}

function lineLooksCommentOnly(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

describe("apihub leakage conformance (console)", () => {
  it("HTTP routes do not console.* request headers, authorization, or cookies", () => {
    const files = collectTsFiles(APIHUB_HTTP_ROOT, { skipTest: true });
    expect(files.length).toBeGreaterThan(5);
    const offenders: string[] = [];
    for (const abs of files) {
      const text = fs.readFileSync(abs, "utf8");
      const rel = path.relative(process.cwd(), abs);
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        if (!CONSOLE_METHOD.test(line) || lineLooksCommentOnly(line)) continue;
        const lower = line.toLowerCase();
        const bad =
          lower.includes("request.headers") ||
          lower.includes(".headers.get(") ||
          lower.includes("authorization") ||
          lower.includes("set-cookie") ||
          /\bcookies?\b/.test(lower) ||
          lower.includes("json.stringify(request");
        if (bad) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("lib/apihub (non-test) avoids console.* except safe-server-log.ts", () => {
    const files = collectTsFiles(APIHUB_LIB_ROOT, { skipTest: true }).filter(
      (p) => !p.endsWith(`${path.sep}safe-server-log.ts`),
    );
    const offenders: string[] = [];
    for (const abs of files) {
      const text = fs.readFileSync(abs, "utf8");
      if (!CONSOLE_METHOD.test(text)) continue;
      const rel = path.relative(process.cwd(), abs);
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe("logApiHubBackgroundError", () => {
  it("logs Error name and message only (no stack)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logApiHubBackgroundError("ctx", new Error("boom"));
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0] as unknown[];
    expect(args[0]).toBe("[apihub] ctx");
    expect(args[1]).toEqual({ name: "Error", message: "boom" });
    spy.mockRestore();
  });
});
