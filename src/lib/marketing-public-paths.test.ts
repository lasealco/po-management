import { describe, expect, it } from "vitest";

import {
  MARKETING_PRICING_PATH,
  MARKETING_PUBLIC_HELP_PATHS,
  PLATFORM_HUB_PATH,
} from "@/lib/marketing-public-paths";

describe("marketing-public-paths", () => {
  it("keeps the help tuple aligned with named entry points", () => {
    expect(MARKETING_PUBLIC_HELP_PATHS).toEqual([MARKETING_PRICING_PATH, PLATFORM_HUB_PATH]);
  });
});
