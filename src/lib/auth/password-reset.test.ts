import { describe, expect, it } from "vitest";

import {
  hashPasswordResetToken,
  newPasswordResetSecret,
  safeEqualTokenHash,
} from "./password-reset";

describe("password reset tokens", () => {
  it("newPasswordResetSecret produces verifiable hash", () => {
    const { raw, tokenHash } = newPasswordResetSecret();
    expect(raw.length).toBe(64);
    expect(tokenHash).toBe(hashPasswordResetToken(raw));
  });

  it("safeEqualTokenHash rejects different secrets", () => {
    const a = hashPasswordResetToken("a");
    const b = hashPasswordResetToken("b");
    expect(safeEqualTokenHash(a, b)).toBe(false);
  });

  it("safeEqualTokenHash accepts equal digests", () => {
    const t = "abc";
    const h = hashPasswordResetToken(t);
    expect(safeEqualTokenHash(h, hashPasswordResetToken(t))).toBe(true);
  });
});
