import { APIHUB_AUTH_CONFIG_REF_MAX_LEN } from "@/lib/apihub/constants";

export type ApiHubAuthConfigRefValidationIssueCode =
  | "INVALID_TYPE"
  | "MAX_LENGTH"
  | "INVALID_CHAR"
  | "INVALID_PATTERN";

type ValidateOk = { ok: true; value: string | null };
type ValidateErr = { ok: false; code: ApiHubAuthConfigRefValidationIssueCode; message: string };

export type ApiHubAuthConfigRefValidationResult = ValidateOk | ValidateErr;

function hasControlOrFormatBreakingChars(s: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(s);
}

/**
 * Allowed secret-manager style pointers only (no raw secrets, no arbitrary URLs).
 * Extend deliberately when adding providers.
 */
export function isApiHubAuthConfigRefFormatAllowed(ref: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed) {
    return false;
  }
  if (/^vault:\/\/.+/i.test(trimmed)) {
    return true;
  }
  if (/^arn:aws:secretsmanager:[^:\s]+:[^:\s]+:secret:\S+$/i.test(trimmed)) {
    return true;
  }
  if (/^arn:aws:ssm:[^:\s]+:[^:\s]+:parameter\/.+$/i.test(trimmed)) {
    return true;
  }
  if (/^gsm:\/\/.+/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Validates a PATCH body value for `authConfigRef`: `null` clears; trimmed empty string clears;
 * non-empty must match allowlisted patterns and length.
 */
export function validateApiHubAuthConfigRefForWrite(raw: unknown): ApiHubAuthConfigRefValidationResult {
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, code: "INVALID_TYPE", message: "authConfigRef must be a string or null." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (hasControlOrFormatBreakingChars(trimmed)) {
    return {
      ok: false,
      code: "INVALID_CHAR",
      message: "authConfigRef cannot contain control characters.",
    };
  }
  if (trimmed.length > APIHUB_AUTH_CONFIG_REF_MAX_LEN) {
    return {
      ok: false,
      code: "MAX_LENGTH",
      message: `authConfigRef must be at most ${APIHUB_AUTH_CONFIG_REF_MAX_LEN} characters after trimming.`,
    };
  }
  if (!isApiHubAuthConfigRefFormatAllowed(trimmed)) {
    return {
      ok: false,
      code: "INVALID_PATTERN",
      message:
        "authConfigRef must start with vault://, gsm://, arn:aws:secretsmanager:, or arn:aws:ssm:…:parameter/….",
    };
  }
  return { ok: true, value: trimmed };
}
