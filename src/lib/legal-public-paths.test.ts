import { describe, expect, it } from "vitest";

import { PATHS_WITHOUT_APP_CHROME } from "@/lib/app-shell-paths";
import {
  LEGAL_COOKIES_PATH,
  LEGAL_PRIVACY_PATH,
  LEGAL_PUBLIC_HELP_PATHS,
  LEGAL_TERMS_PATH,
} from "@/lib/legal-public-paths";

describe("legal-public-paths", () => {
  it("exports a fixed tuple matching the named paths", () => {
    expect(LEGAL_PUBLIC_HELP_PATHS).toEqual([LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, LEGAL_COOKIES_PATH]);
  });

  it("keeps every legal path in PATHS_WITHOUT_APP_CHROME (marketing-style shell)", () => {
    for (const p of LEGAL_PUBLIC_HELP_PATHS) {
      expect(PATHS_WITHOUT_APP_CHROME.has(p), `expected chrome-free: ${p}`).toBe(true);
    }
  });
});
