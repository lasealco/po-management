import { describe, expect, it } from "vitest";

import {
  APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER,
  APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_CAP,
  APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_MIN,
  apiHubIngestionMaxAttemptsForTrigger,
} from "./constants";

describe("apiHubIngestionMaxAttemptsForTrigger", () => {
  it("returns configured policy per trigger kind", () => {
    expect(apiHubIngestionMaxAttemptsForTrigger("api")).toBe(APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER.api);
    expect(apiHubIngestionMaxAttemptsForTrigger("manual")).toBe(
      APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER.manual,
    );
    expect(apiHubIngestionMaxAttemptsForTrigger("scheduled")).toBe(
      APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_BY_TRIGGER.scheduled,
    );
  });

  it("keeps each trigger policy within global min/max bounds", () => {
    for (const kind of ["api", "manual", "scheduled"] as const) {
      const n = apiHubIngestionMaxAttemptsForTrigger(kind);
      expect(n).toBeGreaterThanOrEqual(APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_MIN);
      expect(n).toBeLessThanOrEqual(APIHUB_INGESTION_RETRY_MAX_ATTEMPTS_CAP);
    }
  });
});
