/**
 * Public legal pages (no app chrome). Keep in sync with `PATHS_WITHOUT_APP_CHROME`, `proxy` PUBLIC_PATHS,
 * and `help-actions` OPEN_PATH_ALLOWLIST.
 */
export const LEGAL_PRIVACY_PATH = "/privacy" as const;
export const LEGAL_TERMS_PATH = "/terms" as const;
export const LEGAL_COOKIES_PATH = "/cookies" as const;

export const LEGAL_PUBLIC_HELP_PATHS = [LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, LEGAL_COOKIES_PATH] as const;

export type LegalPublicHelpPath = (typeof LEGAL_PUBLIC_HELP_PATHS)[number];
