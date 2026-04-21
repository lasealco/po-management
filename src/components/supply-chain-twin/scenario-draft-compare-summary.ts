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

/** Top-level object key buckets for compare v1 (no deep structural diff). */
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
  return { kind: "objects", onlyInLeft, onlyInRight, sameKeys, changedKeys };
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
