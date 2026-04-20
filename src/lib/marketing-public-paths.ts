/**
 * Public marketing pricing page and signed-in platform hub.
 * Legal URLs (`legal-public-paths.ts`) share the same help playbook and allowlist patterns; this tuple is
 * marketing + hub only. Used by help `open_path`, `public_marketing` steps 0–1, and command palette — keep
 * in sync with `OPEN_PATH_ALLOWLIST` in `help-actions.ts`.
 */
export const MARKETING_PRICING_PATH = "/pricing" as const;
export const PLATFORM_HUB_PATH = "/platform" as const;

export const MARKETING_PUBLIC_HELP_PATHS = [MARKETING_PRICING_PATH, PLATFORM_HUB_PATH] as const;

export type MarketingPublicHelpPath = (typeof MARKETING_PUBLIC_HELP_PATHS)[number];
