/**
 * GS1 Modulo-10 check digit and SSCC-18 helpers for ship-station / label integration (BF-08).
 * Not a substitute for full GS1 Company Prefix allocation — demo builds derive serial digits deterministically from `outboundId`.
 */

/** GS1 Modulo-10 (digits only). Weight ×3 on positions 1,3,5… from the **right**. */
export function computeGs1Mod10CheckDigit(bodyDigits: string): number {
  if (!/^\d+$/.test(bodyDigits) || bodyDigits.length === 0) {
    throw new Error("GS1 Mod-10 input must be a non-empty numeric string");
  }
  let sum = 0;
  for (let i = bodyDigits.length - 1; i >= 0; i--) {
    const posFromRight = bodyDigits.length - i;
    const d = bodyDigits.charCodeAt(i) - 48;
    sum += d * (posFromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function verifyGs1Mod10CheckDigit(fullDigitsIncludingCheck: string): boolean {
  if (fullDigitsIncludingCheck.length < 2 || !/^\d+$/.test(fullDigitsIncludingCheck)) return false;
  const body = fullDigitsIncludingCheck.slice(0, -1);
  const check = parseInt(fullDigitsIncludingCheck.slice(-1), 10);
  return computeGs1Mod10CheckDigit(body) === check;
}

/** Append Mod-10 check digit to a **17-digit** SSCC body → **18-digit** SSCC (numeric string). */
export function formatSscc18FromBody17(body17: string): string {
  if (!/^\d{17}$/.test(body17)) {
    throw new Error("SSCC body must be exactly 17 digits (extension + prefix + serial allocation)");
  }
  return `${body17}${computeGs1Mod10CheckDigit(body17)}`;
}

function deterministicDigitsFromSeed(seed: string, len: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  for (let i = 0; i < len; i++) {
    h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
    out += String(h % 10);
  }
  return out.slice(0, len);
}

/**
 * Builds the **17-digit** SSCC body using extension digit + GS1 company prefix (7–10 digits) + deterministic serial.
 * Total length: 1 + prefixLength + serialLength = 17.
 */
export function buildSscc18DemoBody17(params: {
  outboundId: string;
  companyPrefixDigits: string;
  extensionDigit?: string;
}): string {
  const ext = (params.extensionDigit ?? "0").replace(/\D/g, "").slice(0, 1) || "0";
  const cp = params.companyPrefixDigits.replace(/\D/g, "");
  if (cp.length < 7 || cp.length > 10) {
    throw new Error("companyPrefixDigits must contain 7–10 digits for demo SSCC construction");
  }
  const serialLen = 17 - 1 - cp.length;
  const serial = deterministicDigitsFromSeed(params.outboundId, serialLen);
  return `${ext}${cp}${serial}`;
}

export function buildSscc18DemoFromOutbound(outboundId: string, companyPrefixDigits: string): string {
  const body17 = buildSscc18DemoBody17({ outboundId, companyPrefixDigits });
  return formatSscc18FromBody17(body17);
}
