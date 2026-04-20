import { describe, expect, it } from "vitest";

import { PATHS_WITHOUT_APP_CHROME, pathUsesAppChrome } from "@/lib/app-shell-paths";
import {
  LEGAL_COOKIES_PATH,
  LEGAL_PRIVACY_PATH,
  LEGAL_PUBLIC_HELP_PATHS,
  LEGAL_TERMS_PATH,
} from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

describe("PATHS_WITHOUT_APP_CHROME", () => {
  it("includes marketing pricing but not the signed-in platform hub", () => {
    expect(PATHS_WITHOUT_APP_CHROME.has(MARKETING_PRICING_PATH)).toBe(true);
    expect(PATHS_WITHOUT_APP_CHROME.has(PLATFORM_HUB_PATH)).toBe(false);
  });

  it("includes all legal public paths", () => {
    for (const p of LEGAL_PUBLIC_HELP_PATHS) {
      expect(PATHS_WITHOUT_APP_CHROME.has(p)).toBe(true);
    }
  });
});

describe("pathUsesAppChrome", () => {
  it("is false for marketing and legal chrome-only routes", () => {
    expect(pathUsesAppChrome("/")).toBe(false);
    expect(pathUsesAppChrome(MARKETING_PRICING_PATH)).toBe(false);
    expect(pathUsesAppChrome(LEGAL_PRIVACY_PATH)).toBe(false);
    expect(pathUsesAppChrome(LEGAL_TERMS_PATH)).toBe(false);
    expect(pathUsesAppChrome(LEGAL_COOKIES_PATH)).toBe(false);
  });

  it("is true for platform hub and core app modules", () => {
    expect(pathUsesAppChrome(PLATFORM_HUB_PATH)).toBe(true);
    expect(pathUsesAppChrome("/orders")).toBe(true);
    expect(pathUsesAppChrome("/tariffs/contracts")).toBe(true);
  });
});
