#!/usr/bin/env node
/**
 * Supply Chain Twin end-to-end smoke pack (sequential).
 *
 * Usage:
 *   npm run smoke:sctwin:e2e
 *   SCTWIN_SMOKE_BASE_URL="http://localhost:3000" npm run smoke:sctwin:e2e
 */

const baseUrl = (process.env.SCTWIN_SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SCTWIN_SMOKE_TIMEOUT_MS || "15000", 10);

const checks = [
  {
    key: "readiness",
    url: "/api/supply-chain-twin/readiness",
    validate: (body) => typeof body === "object" && body != null && "ok" in body,
  },
  {
    key: "explorer",
    url: "/api/supply-chain-twin/entities?fields=summary&limit=1",
    validate: (body) => typeof body === "object" && body != null && Array.isArray(body.items),
  },
  {
    key: "scenarios",
    url: "/api/supply-chain-twin/scenarios?limit=1",
    validate: (body) => typeof body === "object" && body != null && Array.isArray(body.items),
  },
  {
    key: "risks",
    url: "/api/supply-chain-twin/risk-signals?limit=1",
    validate: (body) => typeof body === "object" && body != null && Array.isArray(body.items),
  },
  {
    key: "exports",
    url: "/api/supply-chain-twin/events/export?format=json&limit=1&includePayload=false",
    validate: (body) => typeof body === "object" && body != null && Array.isArray(body.events),
  },
];

function nowIso() {
  return new Date().toISOString();
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      durationMs: Date.now() - startedAt,
    };
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
      const result = await fetchJson(check.url);
      step.status = result.status;
      step.durationMs = result.durationMs;
      if (!result.ok) {
        step.error = `HTTP_${result.status}`;
      } else if (!check.validate(result.body)) {
        step.error = "SCHEMA_SHAPE_INVALID";
      } else {
        step.ok = true;
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";
      step.error = name === "AbortError" ? "REQUEST_TIMEOUT" : name;
    }
    results.push(step);
  }

  const ok = results.every((r) => r.ok);
  const summary = {
    suite: "sctwin-e2e-smoke-pack",
    baseUrl,
    startedAt,
    finishedAt: nowIso(),
    ok,
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
        suite: "sctwin-e2e-smoke-pack",
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
