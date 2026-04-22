/**
 * Central API Hub request abuse budgets (P4). Routes should prefer tier helpers so caps stay consistent.
 */
import { APIHUB_JSON_BODY_MAX_BYTES, APIHUB_JSON_BODY_MAX_BYTES_LARGE } from "@/lib/apihub/constants";
import {
  parseApiHubPostJsonForRoute,
  parseApiHubRequestJson,
  type ParseApiHubRequestJsonResult,
} from "@/lib/apihub/request-body-limit";

/** Default POST/PATCH JSON cap (256 KiB). */
export type ApiHubJsonBodyBudgetTier = "standard" | "large";

const TIER_BYTES: Record<ApiHubJsonBodyBudgetTier, number> = {
  standard: APIHUB_JSON_BODY_MAX_BYTES,
  large: APIHUB_JSON_BODY_MAX_BYTES_LARGE,
};

export function apiHubJsonBodyMaxBytes(tier: ApiHubJsonBodyBudgetTier): number {
  return TIER_BYTES[tier];
}

export async function parseApiHubPostJsonForRouteWithBudget(
  request: Request,
  requestId: string,
  tier: ApiHubJsonBodyBudgetTier,
  options?: { emptyOnInvalid?: boolean },
): ReturnType<typeof parseApiHubPostJsonForRoute> {
  return parseApiHubPostJsonForRoute(request, requestId, apiHubJsonBodyMaxBytes(tier), options);
}

export async function parseApiHubRequestJsonWithBudget(
  request: Request,
  tier: ApiHubJsonBodyBudgetTier,
  options?: { emptyOnInvalid?: boolean },
): Promise<ParseApiHubRequestJsonResult> {
  return parseApiHubRequestJson(request, apiHubJsonBodyMaxBytes(tier), options);
}
