/** Stable service id for health payloads and logging. */
export const APIHUB_SERVICE = "apihub" as const;

/** Current shipped phase label for health/discovery payloads. */
export const APIHUB_PHASE = "P2" as const;

/** Narrow lifecycle enum for Phase 2 connector registry updates. */
export const APIHUB_CONNECTOR_STATUSES = ["draft", "active", "paused", "error"] as const;
export type ApiHubConnectorStatus = (typeof APIHUB_CONNECTOR_STATUSES)[number];

/** Non-secret auth mode metadata for connector setup. */
export const APIHUB_CONNECTOR_AUTH_MODES = ["none", "api_key_ref", "oauth_client_ref", "basic_ref"] as const;
export type ApiHubConnectorAuthMode = (typeof APIHUB_CONNECTOR_AUTH_MODES)[number];

/** Operator-visible auth setup readiness states. */
export const APIHUB_CONNECTOR_AUTH_STATES = ["not_configured", "configured", "error"] as const;
export type ApiHubConnectorAuthState = (typeof APIHUB_CONNECTOR_AUTH_STATES)[number];
