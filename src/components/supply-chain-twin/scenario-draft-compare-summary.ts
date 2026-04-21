type RootShape =
  | { kind: "null" }
  | { kind: "array" }
  | { kind: "object"; keys: string[] }
  | { kind: "primitive"; tag: string };

function rootShape(d: unknown): RootShape {
  if (d === null) {
    return { kind: "null" };
  }
  if (typeof d !== "object") {
    return { kind: "primitive", tag: typeof d };
  }
  if (Array.isArray(d)) {
    return { kind: "array" };
  }
  return { kind: "object", keys: Object.keys(d as Record<string, unknown>).sort() };
}

/** One row in the depth-2 path strip (Slice 72); paths use dot notation (`parent.child`). */
export type DraftNestedPathEntryV1 = {
  path: string;
  kind: "diff" | "only_left" | "only_right";
};

/** Max nested path rows materialized before UI truncation (compare panel). */
export const DRAFT_COMPARE_NESTED_PATH_MAX_NODES = 48;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * For top-level `changedKeys` where both sides are plain objects, lists depth-2 paths (parent.child) for
 * differing or side-only subkeys. Non-object value changes are covered by `changedKeys` only (no extra rows).
 */
function collectNestedPathDiffsDepth2(
  leftObj: Record<string, unknown>,
  rightObj: Record<string, unknown>,
  changedKeys: string[],
  maxNodes: number,
): { entries: DraftNestedPathEntryV1[]; overflow: number } {
  const collected: DraftNestedPathEntryV1[] = [];
  for (const parent of [...changedKeys].sort()) {
    const lv = leftObj[parent];
    const rv = rightObj[parent];
    if (!isPlainObject(lv) || !isPlainObject(rv)) {
      continue;
    }
    const lk = Object.keys(lv).sort();
    const rk = Object.keys(rv).sort();
    const setR = new Set(rk);
    const setL = new Set(lk);
    for (const sub of lk) {
      if (!setR.has(sub)) {
        collected.push({ path: `${parent}.${sub}`, kind: "only_left" });
      }
    }
    for (const sub of rk) {
      if (!setL.has(sub)) {
        collected.push({ path: `${parent}.${sub}`, kind: "only_right" });
      }
    }
    for (const sub of lk) {
      if (!setR.has(sub)) {
        continue;
      }
      let ls: string;
      let rs: string;
      try {
        ls = JSON.stringify(lv[sub]);
        rs = JSON.stringify(rv[sub]);
      } catch {
        collected.push({ path: `${parent}.${sub}`, kind: "diff" });
        continue;
      }
      if (ls !== rs) {
        collected.push({ path: `${parent}.${sub}`, kind: "diff" });
      }
    }
  }
  collected.sort((a, b) => a.path.localeCompare(b.path));
  if (collected.length <= maxNodes) {
    return { entries: collected, overflow: 0 };
  }
  return {
    entries: collected.slice(0, maxNodes),
    overflow: collected.length - maxNodes,
  };
}

/** Top-level object key buckets for compare v1, plus capped depth-2 path hints (Slice 72). */
export type DraftTopLevelKeyDiffV1 =
  | {
      kind: "objects";
      /** Keys present only on the left draft. */
      onlyInLeft: string[];
      /** Keys present only on the right draft. */
      onlyInRight: string[];
      /** Shared keys whose serialized values match. */
      sameKeys: string[];
      /** Shared keys whose serialized values differ. */
      changedKeys: string[];
      /** Depth ≤ 2 paths under changed object-valued keys (capped; see overflow). */
      nestedPathDiffs: DraftNestedPathEntryV1[];
      nestedPathDiffsOverflow: number;
    }
  | { kind: "non_object"; narrative: string };

/**
 * When both roots are plain objects, classifies keys as only-left / only-right / same value / changed value.
 * Otherwise returns a short narrative (reuses {@link describeDraftRootKeyDiff}).
 */
export function computeDraftTopLevelKeyDiffV1(leftDraft: unknown, rightDraft: unknown): DraftTopLevelKeyDiffV1 {
  const a = rootShape(leftDraft);
  const b = rootShape(rightDraft);
  if (a.kind !== "object" || b.kind !== "object") {
    return { kind: "non_object", narrative: describeDraftRootKeyDiff(leftDraft, rightDraft) };
  }
  const leftObj = leftDraft as Record<string, unknown>;
  const rightObj = rightDraft as Record<string, unknown>;
  const setA = new Set(a.keys);
  const setB = new Set(b.keys);
  const onlyInLeft = a.keys.filter((k) => !setB.has(k)).sort();
  const onlyInRight = b.keys.filter((k) => !setA.has(k)).sort();
  const shared = a.keys.filter((k) => setB.has(k)).sort();
  const sameKeys: string[] = [];
  const changedKeys: string[] = [];
  for (const k of shared) {
    let ls: string;
    let rs: string;
    try {
      ls = JSON.stringify(leftObj[k]);
      rs = JSON.stringify(rightObj[k]);
    } catch {
      changedKeys.push(k);
      continue;
    }
    if (ls === rs) {
      sameKeys.push(k);
    } else {
      changedKeys.push(k);
    }
  }
  const { entries: nestedPathDiffs, overflow: nestedPathDiffsOverflow } = collectNestedPathDiffsDepth2(
    leftObj,
    rightObj,
    changedKeys,
    DRAFT_COMPARE_NESTED_PATH_MAX_NODES,
  );
  return {
    kind: "objects",
    onlyInLeft,
    onlyInRight,
    sameKeys,
    changedKeys,
    nestedPathDiffs,
    nestedPathDiffsOverflow,
  };
}

/** Human-readable comparison of two `draft` JSON roots (no deep diff). */
export function describeDraftRootKeyDiff(leftDraft: unknown, rightDraft: unknown): string {
  const a = rootShape(leftDraft);
  const b = rootShape(rightDraft);
  if (a.kind === "object" && b.kind === "object") {
    const setB = new Set(b.keys);
    const setA = new Set(a.keys);
    const sameKeys = a.keys.length === b.keys.length && a.keys.every((k) => setB.has(k));
    if (sameKeys) {
      const label = a.keys.length === 0 ? "(no keys)" : a.keys.join(", ");
      return `Same top-level object keys (${a.keys.length}): ${label}`;
    }
    const onlyLeft = a.keys.filter((k) => !setB.has(k));
    const onlyRight = b.keys.filter((k) => !setA.has(k));
    return [
      "Different top-level object keys.",
      onlyLeft.length ? `Only in left: ${onlyLeft.join(", ")}.` : "Only in left: —.",
      onlyRight.length ? `Only in right: ${onlyRight.join(", ")}.` : "Only in right: —.",
    ].join(" ");
  }
  if (a.kind === b.kind && a.kind === "null") {
    return "Both drafts are JSON null at root.";
  }
  if (a.kind === b.kind && a.kind === "array") {
    return "Both drafts are JSON arrays at root (key diff not applicable).";
  }
  if (a.kind === b.kind && a.kind === "primitive" && b.kind === "primitive" && a.tag === b.tag) {
    return `Both drafts are JSON primitives at root (type ${a.tag}).`;
  }
  return `Different JSON shapes at root (${a.kind} vs ${b.kind}).`;
}

const DEFAULT_MAX_BYTES = 48_000;

/** True when serialized drafts match; false when different; null when comparison skipped (oversize). */
export function draftsDeepEqualSerialized(
  leftDraft: unknown,
  rightDraft: unknown,
  maxUtf8Bytes: number = DEFAULT_MAX_BYTES,
): boolean | null {
  let left: string;
  let right: string;
  try {
    left = JSON.stringify(leftDraft ?? null);
    right = JSON.stringify(rightDraft ?? null);
  } catch {
    return false;
  }
  const enc = new TextEncoder();
  if (enc.encode(left).length > maxUtf8Bytes || enc.encode(right).length > maxUtf8Bytes) {
    return null;
  }
  return left === right;
}
