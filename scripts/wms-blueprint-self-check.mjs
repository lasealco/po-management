#!/usr/bin/env node
/**
 * BF-100 — Compare shipped `POST /api/wms` action discriminators in
 * `src/lib/wms/post-actions.ts` vs snake_case action tokens implied by
 * [`docs/wms/GAP_MAP.md`](../docs/wms/GAP_MAP.md) §Existing API actions.
 *
 * Usage: `node scripts/wms-blueprint-self-check.mjs` [--json]
 * Exit 1 when sets differ (contract drift).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const POST_ACTIONS_FILE = path.join(ROOT, "src/lib/wms/post-actions.ts");
const GAP_MAP_FILE = path.join(ROOT, "docs/wms/GAP_MAP.md");

const ACTIONS_HEADING = "## Existing API actions (`POST /api/wms`)";
const HANDLERS_SENTINEL = "\nHandlers live";

/** Primary handlers use `if (action === "…")` in `handleWmsPost`. */
function extractPostActionsFromPostActionsTs(src) {
  const re = /if \(action === "([^"]+)"\)/g;
  const set = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    set.add(m[1]);
  }
  return set;
}

/**
 * GAP_MAP prose lists actions as backticks and bare comma-separated ids.
 * Restrict to lowercase snake_case tokens with at least one underscore.
 */
function extractActionTokensFromGapParagraph(paragraph) {
  const set = new Set();
  const tokenRe = /\b([a-z][a-z0-9_]*_[a-z0-9_]+)\b/g;
  let m;
  while ((m = tokenRe.exec(paragraph)) !== null) {
    set.add(m[1]);
  }
  return set;
}

function readGapMapActionsParagraph(gapMd) {
  const idx = gapMd.indexOf(ACTIONS_HEADING);
  if (idx === -1) {
    throw new Error(`GAP_MAP.md: missing heading ${ACTIONS_HEADING}`);
  }
  const afterHeading = gapMd.slice(idx + ACTIONS_HEADING.length);
  const nextSection = afterHeading.search(/\n## /);
  const section = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection);
  const handlersIdx = section.indexOf(HANDLERS_SENTINEL);
  const beforeHandlers = handlersIdx === -1 ? section : section.slice(0, handlersIdx);
  const bf100Idx = beforeHandlers.indexOf("\n\n**BF-100:**");
  const actionsOnly = bf100Idx === -1 ? beforeHandlers : beforeHandlers.slice(0, bf100Idx);
  return actionsOnly.trim();
}

function sorted(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

function main() {
  const jsonOut = process.argv.includes("--json");

  const postSrc = fs.readFileSync(POST_ACTIONS_FILE, "utf8");
  const gapMd = fs.readFileSync(GAP_MAP_FILE, "utf8");

  const codeActions = extractPostActionsFromPostActionsTs(postSrc);
  const gapParagraph = readGapMapActionsParagraph(gapMd);
  const gapTokens = extractActionTokensFromGapParagraph(gapParagraph);

  const inCodeNotGap = sorted([...codeActions].filter((a) => !gapTokens.has(a)));
  const inGapNotCode = sorted([...gapTokens].filter((a) => !codeActions.has(a)));

  const report = {
    schemaVersion: "bf100.v1",
    postActionsFile: path.relative(ROOT, POST_ACTIONS_FILE),
    gapMapFile: path.relative(ROOT, GAP_MAP_FILE),
    codeActionCount: codeActions.size,
    gapTokenCount: gapTokens.size,
    inCodeNotGap,
    inGapNotCode,
    ok: inCodeNotGap.length === 0 && inGapNotCode.length === 0,
  };

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `BF-100 WMS blueprint self-check (${report.schemaVersion})\n` +
        `  post-actions.ts discriminators: ${report.codeActionCount}\n` +
        `  GAP_MAP snake_case tokens (§Existing API actions): ${report.gapTokenCount}\n`,
    );
    if (report.inCodeNotGap.length) {
      process.stdout.write(`  IN CODE, MISSING FROM GAP prose (${report.inCodeNotGap.length}):\n`);
      for (const a of report.inCodeNotGap) {
        process.stdout.write(`    - ${a}\n`);
      }
    }
    if (report.inGapNotCode.length) {
      process.stdout.write(`  IN GAP prose, NOT IN post-actions.ts (${report.inGapNotCode.length}):\n`);
      for (const a of report.inGapNotCode) {
        process.stdout.write(`    - ${a}\n`);
      }
    }
    if (report.ok) {
      process.stdout.write("  OK — no drift detected.\n");
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main();
