#!/usr/bin/env node
/**
 * API Hub lightweight smoke pack (no cookies / no secrets).
 *
 * `/apihub` and `/apihub/workspace` sit behind `ApihubGate`: without a demo session, HTML checks accept the
 * access-denial shell (`API hub` + demo/org.apihub copy). With `org.apihub` + signed-in demo user, they assert
 * richer shells (guided import + workspace).
 *
 * Usage:
 *   npm run smoke:apihub
 *   APIHUB_SMOKE_BASE_URL="https://your-app.vercel.app" npm run smoke:apihub
 */

const baseUrl = (process.env.APIHUB_SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.APIHUB_SMOKE_TIMEOUT_MS || "15000", 10);

const checks = [
  {
    key: "api_health",
    url: "/api/apihub/health",
    accept: "application/json",
    asJson: true,
    validate: (body) =>
      typeof body === "object" &&
      body != null &&
      body.ok === true &&
      body.service === "apihub" &&
      typeof body.phase === "string" &&
      Object.keys(body).length === 3,
  },
  {
    key: "apihub_page",
    url: "/apihub",
    accept: "text/html",
    asJson: false,
    validate: (body) => {
      if (typeof body !== "string") return false;
      const fullShell = body.includes("Guided import") && body.includes("Connectors");
      const gateShell =
        body.includes("API hub") &&
        (body.includes("Demo session") || body.includes("org.apihub"));
      return fullShell || gateShell;
    },
  },
  {
    key: "apihub_cron_unauthenticated",
    url: "/api/cron/apihub-mapping-analysis-jobs",
    accept: "application/json",
    asJson: true,
    /** Cron without `Authorization` should be rejected or unavailable (no `CRON_SECRET` locally). */
    allowStatuses: [401, 503],
    validate: (body, status) =>
      (status === 401 || status === 503) &&
      typeof body === "object" &&
      body != null &&
      typeof body.error === "string" &&
      typeof body.code === "string" &&
      Object.keys(body).length === 2,
  },
  {
    key: "apihub_workspace_page",
    url: "/apihub/workspace",
    accept: "text/html",
    asJson: false,
    validate: (body) => {
      if (typeof body !== "string") return false;
      // With demo session + org.apihub: full workspace. Without auth: ApihubGate still proves route + layout work.
      const fullShell =
        body.includes("Operator workspace") &&
        (body.includes('id="ingestion-ops"') || body.includes("ingestion-ops"));
      const gateShell =
        body.includes("API hub") &&
        (body.includes("Demo session") || body.includes("org.apihub"));
      return fullShell || gateShell;
    },
  },
];

function classifyRequestError(error) {
  const name = error instanceof Error ? error.name : "UnknownError";
  if (name === "AbortError") {
    return "REQUEST_TIMEOUT";
  }
  if (name === "TypeError") {
    return "BASE_URL_UNREACHABLE";
  }
  return name;
}

function nowIso() {
  return new Date().toISOString();
}

async function fetchStep(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${check.url}`, {
      headers: { Accept: check.accept },
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    if (check.asJson) {
      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { ok: response.ok, status: response.status, body, durationMs };
    }
    const text = await response.text();
    return { ok: response.ok, status: response.status, body: text, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const startedAt = nowIso();
  const results = [];

  for (const check of checks) {
    const step = {
      key: check.key,
      route: check.url,
      ok: false,
      status: 0,
      durationMs: 0,
      error: null,
    };
    try {
      const result = await fetchStep(check);
      step.status = result.status;
      step.durationMs = result.durationMs;
      const allowed = check.allowStatuses;
      const statusAccepted =
        Array.isArray(allowed) && allowed.length > 0
          ? allowed.includes(result.status)
          : result.ok;
      if (!statusAccepted) {
        step.error = `HTTP_${result.status}`;
      } else if (!check.validate(result.body, result.status)) {
        step.error = "RESPONSE_SHAPE_INVALID";
      } else {
        step.ok = true;
      }
    } catch (error) {
      step.error = classifyRequestError(error);
    }
    results.push(step);
  }

  const ok = results.every((r) => r.ok);
  const baseUrlReachable = !results.some((r) => r.error === "BASE_URL_UNREACHABLE");
  const summary = {
    suite: "apihub-smoke-pack",
    baseUrl,
    startedAt,
    finishedAt: nowIso(),
    ok,
    baseUrlReachable,
    blockingReason: baseUrlReachable ? null : "BASE_URL_UNREACHABLE",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    steps: results,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(
    JSON.stringify(
      {
        suite: "apihub-smoke-pack",
        baseUrl,
        ok: false,
        fatal: name,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
