#!/usr/bin/env node
/**
 * API Hub lightweight smoke pack (no cookies / no secrets).
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
      typeof body.service === "string" &&
      typeof body.phase === "string",
  },
  {
    key: "apihub_page",
    url: "/apihub",
    accept: "text/html",
    asJson: false,
    validate: (body) =>
      typeof body === "string" &&
      body.includes("Integration and ingestion hub") &&
      body.includes("Connectors"),
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
      if (!result.ok) {
        step.error = `HTTP_${result.status}`;
      } else if (!check.validate(result.body)) {
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
