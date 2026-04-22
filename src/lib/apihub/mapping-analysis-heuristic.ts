import {
  APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC,
  APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT,
} from "@/lib/apihub/constants";
import type { ApiHubMappingRule, ApiHubMappingTransform } from "@/lib/apihub/mapping-engine";
import { getApiHubMappingPathValue, validateApiHubMappingSourcePathSyntax } from "@/lib/apihub/mapping-engine";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

function pathToTargetField(sourcePath: string): string {
  return sourcePath
    .replace(/\[0\]/g, "_item")
    .replace(/\./g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function collectLeafPaths(value: unknown, prefix: string, depth: number, maxDepth: number): string[] {
  if (value == null || depth >= maxDepth) {
    return [];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    const head = value[0];
    const nextPrefix = prefix ? `${prefix}[0]` : `[0]`;
    return collectLeafPaths(head, nextPrefix, depth + 1, maxDepth);
  }
  if (typeof value !== "object") {
    return [];
  }
  const paths: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object") {
      paths.push(...collectLeafPaths(v, p, depth + 1, maxDepth));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

function inferTransform(samples: unknown[]): { transform?: ApiHubMappingTransform; notes: string[] } {
  const notes: string[] = [];
  const defined = samples.filter((s) => s !== undefined && s !== null);
  if (defined.length === 0) {
    return { transform: "identity", notes };
  }

  if (defined.every((s) => typeof s === "number" && Number.isFinite(s))) {
    return { transform: "identity", notes };
  }

  if (
    defined.every((s) => typeof s === "string") &&
    defined.every((s) => ISO_DATE.test((s as string).trim()))
  ) {
    return { transform: "iso_date", notes };
  }

  if (
    defined.every(
      (s) =>
        typeof s === "boolean" ||
        (typeof s === "number" && (s === 0 || s === 1)) ||
        (typeof s === "string" && /^(true|false|yes|no|y|n|on|off|0|1)$/i.test((s as string).trim())),
    )
  ) {
    return { transform: "boolean", notes };
  }

  if (
    defined.every((s) => typeof s === "number" || (typeof s === "string" && s.trim().length > 0)) &&
    defined.every((s) => {
      if (typeof s === "number") {
        return Number.isFinite(s);
      }
      const n = Number((s as string).trim().replace(/,/g, ""));
      return Number.isFinite(n);
    })
  ) {
    notes.push("Inferred number transform from string/numeric samples.");
    return { transform: "number", notes };
  }

  if (defined.every((s) => typeof s === "string")) {
    const trimmed = defined.some((s) => (s as string) !== (s as string).trim());
    if (trimmed) {
      return { transform: "trim", notes };
    }
  }

  return { transform: "identity", notes };
}

export type ApiHubMappingAnalysisProposal = {
  schemaVersion: 1;
  engine: typeof APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC;
  rules: ApiHubMappingRule[];
  notes: string[];
};

/**
 * Deterministic mapping proposal from sample records (no LLM). Paths are derived from the first record’s shape.
 */
export function inferApiHubMappingAnalysisProposal(
  records: unknown[],
  targetFieldsHint: string[] | null,
): { ok: true; proposal: ApiHubMappingAnalysisProposal } | { ok: false; message: string } {
  if (!Array.isArray(records) || records.length === 0) {
    return { ok: false, message: "records must be a non-empty array." };
  }
  if (!records.every((r) => r != null && typeof r === "object" && !Array.isArray(r))) {
    return { ok: false, message: "Each record must be a plain object." };
  }

  const first = records[0] as Record<string, unknown>;
  const paths = collectLeafPaths(first, "", 0, 5);
  const uniquePaths = [...new Set(paths)].filter((p) => validateApiHubMappingSourcePathSyntax(p) === null);

  const sampleCap = Math.min(24, records.length);
  const notes: string[] = [
    `Inferred ${uniquePaths.length} path(s) from the first record; sampled up to ${sampleCap} row(s) per path.`,
  ];

  const rules: ApiHubMappingRule[] = [];
  let hintIdx = 0;

  for (const sourcePath of uniquePaths) {
    if (rules.length >= APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT) {
      notes.push(`Capped rules at ${APIHUB_MAPPING_TEMPLATE_RULES_MAX_COUNT} (template limit).`);
      break;
    }

    const samples: unknown[] = [];
    for (let i = 0; i < sampleCap; i++) {
      samples.push(getApiHubMappingPathValue(records[i], sourcePath));
    }

    const { transform, notes: tNotes } = inferTransform(samples);
    notes.push(...tNotes.map((n) => `${sourcePath}: ${n}`));

    let targetField: string;
    if (targetFieldsHint && hintIdx < targetFieldsHint.length) {
      const h = targetFieldsHint[hintIdx]!.trim();
      hintIdx += 1;
      targetField = h.length > 0 ? h : pathToTargetField(sourcePath);
    } else {
      targetField = pathToTargetField(sourcePath);
    }

    if (!targetField) {
      continue;
    }

    const presentEverywhere = records.every((rec) => {
      const v = getApiHubMappingPathValue(rec, sourcePath);
      return v !== undefined && v !== null && v !== "";
    });

    const rule: ApiHubMappingRule = {
      sourcePath,
      targetField,
      required: presentEverywhere,
      transform,
    };
    rules.push(rule);
  }

  const deduped = dedupeTargetFields(rules);

  return {
    ok: true,
    proposal: {
      schemaVersion: 1,
      engine: APIHUB_MAPPING_ANALYSIS_ENGINE_HEURISTIC,
      rules: deduped,
      notes,
    },
  };
}

function dedupeTargetFields(rules: ApiHubMappingRule[]): ApiHubMappingRule[] {
  const used = new Set<string>();
  return rules.map((r) => {
    let tf = r.targetField;
    let n = 0;
    while (used.has(tf)) {
      n += 1;
      tf = `${r.targetField}_${n}`;
    }
    used.add(tf);
    return tf === r.targetField ? r : { ...r, targetField: tf };
  });
}
