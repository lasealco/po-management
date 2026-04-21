import type { ApiHubMappingRule } from "@/lib/apihub/mapping-engine";

export type ApiHubMappingRuleChange = {
  targetField: string;
  baseline: ApiHubMappingRule;
  compare: ApiHubMappingRule;
};

export type ApiHubMappingRulesDiffResult = {
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  added: ApiHubMappingRule[];
  removed: ApiHubMappingRule[];
  changed: ApiHubMappingRuleChange[];
  unchanged: ApiHubMappingRule[];
};

function byTargetField(rules: ApiHubMappingRule[]): Map<string, ApiHubMappingRule> {
  const m = new Map<string, ApiHubMappingRule>();
  for (const r of rules) {
    m.set(r.targetField.trim(), r);
  }
  return m;
}

function normForEquality(r: ApiHubMappingRule) {
  return {
    sourcePath: r.sourcePath.trim(),
    targetField: r.targetField.trim(),
    required: Boolean(r.required),
    transform: r.transform ?? undefined,
  };
}

function rulesEqual(a: ApiHubMappingRule, b: ApiHubMappingRule): boolean {
  const x = normForEquality(a);
  const y = normForEquality(b);
  return (
    x.sourcePath === y.sourcePath &&
    x.targetField === y.targetField &&
    x.required === y.required &&
    x.transform === y.transform
  );
}

function sortByTargetField<T extends { targetField: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.targetField.localeCompare(b.targetField));
}

/**
 * Compare two validated rule lists keyed by `targetField`.
 * `baseline` is the reference (e.g. saved template); `compare` is the draft (e.g. editor JSON).
 */
export function diffApiHubMappingRules(baseline: ApiHubMappingRule[], compare: ApiHubMappingRule[]): ApiHubMappingRulesDiffResult {
  const bMap = byTargetField(baseline);
  const cMap = byTargetField(compare);

  const added: ApiHubMappingRule[] = [];
  const removed: ApiHubMappingRule[] = [];
  const changed: ApiHubMappingRuleChange[] = [];
  const unchanged: ApiHubMappingRule[] = [];

  for (const [tf, cr] of cMap) {
    const br = bMap.get(tf);
    if (!br) {
      added.push(cr);
    } else if (!rulesEqual(br, cr)) {
      changed.push({ targetField: tf, baseline: br, compare: cr });
    } else {
      unchanged.push(cr);
    }
  }

  for (const [tf, br] of bMap) {
    if (!cMap.has(tf)) {
      removed.push(br);
    }
  }

  return {
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
    added: sortByTargetField(added),
    removed: sortByTargetField(removed),
    changed: sortByTargetField(changed),
    unchanged: sortByTargetField(unchanged),
  };
}
