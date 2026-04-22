import { createHash } from "node:crypto";

import type {
  ApiHubIngestionApplyMatchKey,
  ApiHubIngestionApplyWriteMode,
  ApiHubStagingApplyTarget,
} from "@/lib/apihub/constants";

export type ApplyIdempotencyFingerprintDownstream = {
  target: ApiHubStagingApplyTarget;
  matchKey: ApiHubIngestionApplyMatchKey;
  writeMode: ApiHubIngestionApplyWriteMode;
  /** When omitted, apply rows are resolved from `resultSummary` at execution time. */
  bodyRows?: unknown;
};

export type ApplyIdempotencyFingerprintInput = {
  downstream?: ApplyIdempotencyFingerprintDownstream;
};

function stableValue(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = stableValue(o[k]);
    }
    return out;
  }
  if (Array.isArray(v)) {
    return v.map(stableValue);
  }
  return v;
}

function stableJsonPayload(input: ApplyIdempotencyFingerprintInput): string {
  if (!input.downstream) {
    return JSON.stringify({ v: 1, mode: "marker" });
  }
  const rowsFingerprint =
    input.downstream.bodyRows === undefined
      ? { kind: "resultSummary" as const }
      : { kind: "body" as const, rows: stableValue(input.downstream.bodyRows) };
  return JSON.stringify(
    stableValue({
      v: 1,
      mode: "downstream",
      target: input.downstream.target,
      matchKey: input.downstream.matchKey,
      writeMode: input.downstream.writeMode,
      rows: rowsFingerprint,
    }),
  );
}

/** Fingerprint for `tenantId + idempotencyKey` replay: marker-only vs downstream payload shape. */
export function computeIngestionApplyIdempotencyFingerprint(input: ApplyIdempotencyFingerprintInput): string {
  if (!input.downstream) {
    return "v1:marker";
  }
  const hash = createHash("sha256").update(stableJsonPayload(input), "utf8").digest("hex");
  return `v1:ds:${hash}`;
}
