/**
 * Public marketing pricing page, signed-in platform hub, and guided demo intro slides.
 * Legal URLs (`legal-public-paths.ts`) share the same help playbook and allowlist patterns; marketing
 * tuples here are used by help `open_path`, `public_marketing` steps, and command palette — keep demo intro
 * paths in sync with `OPEN_PATH_ALLOWLIST` in `help-actions.ts`.
 */
export const MARKETING_PRICING_PATH = "/pricing" as const;
export const PLATFORM_HUB_PATH = "/platform" as const;

/** Short guided tour before exploring the live demo tenant (public). */
export const DEMO_INTRO_PATH = "/demo/intro" as const;
export const DEMO_INTRO_HIGHLIGHTS_PATH = "/demo/intro/highlights" as const;

export const DEMO_INTRO_HELP_PATHS = [DEMO_INTRO_PATH, DEMO_INTRO_HIGHLIGHTS_PATH] as const;

export const MARKETING_PUBLIC_HELP_PATHS = [MARKETING_PRICING_PATH, PLATFORM_HUB_PATH] as const;

export type MarketingPublicHelpPath = (typeof MARKETING_PUBLIC_HELP_PATHS)[number];
