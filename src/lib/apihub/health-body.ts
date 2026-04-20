import { APIHUB_PHASE, APIHUB_SERVICE } from "./constants";

export type ApiHubHealthJson = {
  ok: true;
  service: typeof APIHUB_SERVICE;
  phase: typeof APIHUB_PHASE;
};

export function getApiHubHealthJson(): ApiHubHealthJson {
  return { ok: true, service: APIHUB_SERVICE, phase: APIHUB_PHASE };
}
