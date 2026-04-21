const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_RE = /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|credential|ssn|private[-_]?key)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/**
 * Redacts sensitive key paths from arbitrary JSON-like payloads.
 * This is used for export responses to avoid leaking raw secrets.
 */
export function redactTwinSensitivePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactTwinSensitivePayload(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactTwinSensitivePayload(inner);
      }
    }
    return out;
  }
  return value;
}

export { REDACTED as TWIN_SENSITIVE_REDACTED_VALUE };
