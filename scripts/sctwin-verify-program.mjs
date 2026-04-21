#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const steps = [
  { name: "pre-release gate", command: "npm run verify:sctwin:prerelease" },
  { name: "release gate", command: "npm run verify:sctwin:full" },
];

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const startedAt = Date.now();
const results = [];

for (const step of steps) {
  const stepStart = Date.now();
  const run = spawnSync(step.command, {
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  const durationMs = Date.now() - stepStart;
  const ok = (run.status ?? 1) === 0;
  results.push({
    name: step.name,
    command: step.command,
    ok,
    durationMs,
    status: run.status ?? 1,
  });
  if (!ok) {
    break;
  }
}

const totalMs = Date.now() - startedAt;
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
const allPassed = failed === 0 && results.length === steps.length;

console.log("");
console.log("SCTwin program verify summary");
console.log("--------------------------------");
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"}  ${result.name} (${formatMs(result.durationMs)}) :: ${result.command}`,
  );
}
console.log("--------------------------------");
console.log(
  `overall=${allPassed ? "PASS" : "FAIL"} passed=${passed}/${steps.length} failed=${failed} total=${formatMs(totalMs)}`,
);

process.exit(allPassed ? 0 : 1);
