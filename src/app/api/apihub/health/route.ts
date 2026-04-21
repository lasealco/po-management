import { apiHubJson } from "@/lib/apihub/api-error";
import { getApiHubHealthJson } from "@/lib/apihub/health-body";
import { resolveApiHubRequestId } from "@/lib/apihub/request-id";

export function GET(request: Request) {
  const requestId = resolveApiHubRequestId(request);
  return apiHubJson(getApiHubHealthJson(), requestId);
}
