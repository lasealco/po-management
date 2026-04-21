type SctwinApiLogLevel = "error" | "warn";

type SctwinApiLogBase = {
  /** Always true — filter in log drains. */
  sctwinApi: true;
  level: SctwinApiLogLevel;
  ts: string;
  /** HTTP method + path pattern (no query string). */
  route: string;
  /** One of: auth, validation, readiness, catalog, unknown */
  phase: string;
  /** Stable machine code for alerts; never user/tenant text. */
  errorCode: string;
  /** Safe hint only (e.g. Error.name). No emails, ids, or request payloads. */
  detail?: string;
};

function emit(payload: SctwinApiLogBase) {
  const line = JSON.stringify(payload);
  if (payload.level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}

/** Unexpected failures (typically 5xx path). */
export function logSctwinApiError(input: Omit<SctwinApiLogBase, "sctwinApi" | "level" | "ts">) {
  emit({
    sctwinApi: true,
    level: "error",
    ts: new Date().toISOString(),
    ...input,
  });
}

/** Client/validation issues without PII (optional operator signal). */
export function logSctwinApiWarn(input: Omit<SctwinApiLogBase, "sctwinApi" | "level" | "ts">) {
  emit({
    sctwinApi: true,
    level: "warn",
    ts: new Date().toISOString(),
    ...input,
  });
}
