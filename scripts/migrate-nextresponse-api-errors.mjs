#!/usr/bin/env node
/**
 * One-shot helper: replace return NextResponse.json({ error: EXPR }, { status: N })
 * with toApiErrorResponse when EXPR and N are simple (parser handles strings + nesting).
 */
import fs from "node:fs";
import path from "node:path";

const API_ROOT = "src/app/api";

function walkTsFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsFiles(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function listFiles() {
  const root = path.join(process.cwd(), API_ROOT);
  return walkTsFiles(root).filter((fp) => {
    const s = fs.readFileSync(fp, "utf8");
    return /NextResponse\.json\(\s*\{\s*error:/.test(s);
  });
}

function statusToCode(st) {
  switch (Number(st)) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 500:
      return "UNHANDLED";
    case 503:
      return "UNAVAILABLE";
    default:
      return "BAD_INPUT";
  }
}

/** Parse balanced {...} from src[i] where src[i]==='{'. Returns end index after closing }. */
function parseBraceObject(src, start) {
  if (src[start] !== "{") return null;
  let depth = 0;
  let i = start;
  let inS = null;
  let escape = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inS) {
      if (inS === "`") {
        if (escape) {
          escape = false;
          continue;
        }
        if (c === "\\") {
          escape = true;
          continue;
        }
        if (c === "`") {
          inS = null;
          continue;
        }
        if (c === "$" && src[i + 1] === "{") {
          const subEnd = parseBraceObject(src, i + 1);
          if (subEnd === null) return null;
          i = subEnd - 1;
          continue;
        }
        continue;
      }
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && (inS === '"' || inS === "'")) {
        escape = true;
        continue;
      }
      if (c === inS) inS = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inS = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

function tryParseErrorJsonCallAt(src, i) {
  const needle = "return NextResponse.json(";
  if (src.slice(i, i + needle.length) !== needle) return null;

  let p = i + needle.length;
  while (p < src.length && /\s/.test(src[p])) p++;

  const e1 = parseBraceObject(src, p);
  if (e1 === null) return null;

  let q = e1;
  while (q < src.length && /\s/.test(src[q])) q++;
  if (src[q] !== ",") return null;
  q++;
  while (q < src.length && /\s/.test(src[q])) q++;

  const e2 = parseBraceObject(src, q);
  if (e2 === null) return null;

  let r = e2;
  while (r < src.length && /\s/.test(src[r])) r++;
  if (src[r] === ",") {
    r++;
    while (r < src.length && /\s/.test(src[r])) r++;
  }
  if (src[r] !== ")") return null;
  r++;

  const first = src.slice(p, e1).trim();
  const second = src.slice(q, e2).trim();

  const inner = first.slice(1, -1).trim();
  const errM = inner.match(/^error:\s*([\s\S]+)$/);
  if (!errM) return null;
  let errorExpr = errM[1].trim();
  if (errorExpr.endsWith(",")) errorExpr = errorExpr.slice(0, -1).trim();

  const stM = second.match(/^\{\s*status:\s*(\d+)\s*,?\s*\}$/);
  if (!stM) return null;
  const status = stM[1];
  const code = statusToCode(status);

  let end = r;
  while (end < src.length && /\s/.test(src[end])) end++;
  if (src[end] === ";") end++;

  const replacement = `return toApiErrorResponse({ error: ${errorExpr}, code: "${code}", status: ${status} });`;
  return { start: i, end, replacement };
}

/** Next `return NextResponse.json({ error: … }, { status: N })` after fromIdx; skips success JSON responses. */
function parseNextResponseJsonCall(src, fromIdx) {
  const needle = "return NextResponse.json(";
  let search = fromIdx;
  while (search < src.length) {
    const i = src.indexOf(needle, search);
    if (i === -1) return null;
    const parsed = tryParseErrorJsonCallAt(src, i);
    if (parsed) return parsed;
    search = i + 1;
  }
  return null;
}

function endOfImportBlock(lines) {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!/^\s*import\s/.test(line)) break;
    if (/\bfrom\s+["'][^"']+["'];?\s*$/.test(line)) {
      i++;
      continue;
    }
    i++;
    while (i < lines.length && !/\bfrom\s+["']/.test(lines[i])) i++;
    if (i < lines.length) i++;
  }
  return i;
}

function ensureImport(src) {
  if (/import\s*\{[^}]*\btoApiErrorResponse\b/.test(src)) return src;
  const lines = src.split("\n");
  const insertAt = endOfImportBlock(lines);
  const block = [
    'import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";',
    "",
  ];
  lines.splice(insertAt, 0, ...block);
  return lines.join("\n");
}

function migrateOne(path) {
  let src = fs.readFileSync(path, "utf8");
  const orig = src;
  let idx = 0;
  const out = [];
  for (;;) {
    const hit = parseNextResponseJsonCall(src, idx);
    if (!hit) {
      out.push(src.slice(idx));
      break;
    }
    out.push(src.slice(idx, hit.start));
    out.push(hit.replacement);
    idx = hit.end;
  }
  src = out.join("");
  if (src === orig) return { path, changed: false };
  src = ensureImport(src);
  fs.writeFileSync(path, src);
  return { path, changed: true };
}

const files = listFiles();
let changed = 0;
for (const f of files) {
  const r = migrateOne(f);
  if (r.changed) changed++;
}
console.log(`migrate-nextresponse-api-errors: ${changed}/${files.length} files updated`);
