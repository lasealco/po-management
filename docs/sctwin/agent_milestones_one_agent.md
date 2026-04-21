# Supply Chain Twin — one-agent milestones (1–2 h slices)

Use this doc as the **single source of truth** for Cursor/Codex agents: paste or `@`-reference this file, then say **which slice number** to implement.

**Rules for the agent**

- Implement **one slice at a time** unless the user explicitly asks for more.
- **Merge or hand off** before starting the next slice if the user is doing parallel cosmetics (avoid touching the same files).
- Default **charter**: only edit paths listed under that slice; do not expand into unrelated modules (SRM, CRM-only refactors, etc.).
- Ship: `npx tsc --noEmit`, migrations committed if any, no secrets in git.

**Already shipped (baseline)**

- Preview route `/supply-chain-twin`, platform tile + top nav (**Twin**), command palette, help context.
- Visibility flag `supplyChainTwin` on `AppNavLinkVisibility` (derived from existing grants; no `org.sctwin` yet).

---

## Slice 1 — Readiness (~1–1.5 h)

**Goal:** Environment and permissions story before real twin data.

**Milestones**

- [ ] `GET /api/supply-chain-twin/readiness` — JSON `{ ok: boolean, reasons: string[] }` (start with `ok: true` or derive from DB later).
- [ ] Inline callout on `/supply-chain-twin` when `ok === false` (link to `docs/sctwin` or support).
- [ ] Optional: mirror invoice-audit readiness test style if the repo has one.

**Paths (typical):** `src/app/api/supply-chain-twin/readiness/`, `src/app/supply-chain-twin/page.tsx`, `src/lib/supply-chain-twin/readiness.ts` (if extracted).

**Done when:** Page loads without error; API returns stable JSON; cosmetics-friendly (small UI block only).

---

## Slice 2 — Domain skeleton (~1–1.5 h)

**Goal:** One library home for types and constants; no Prisma.

**Milestones**

- [ ] `src/lib/supply-chain-twin/` with `types.ts` (e.g. `TwinEntityKind`, `TwinEntityRef`, `TwinEdge` minimal).
- [ ] `constants.ts` — route prefix, module slug string.
- [ ] Short `README.md` in that folder: scope, non-goals, pointer to `docs/sctwin/README.md`.

**Paths:** under `src/lib/supply-chain-twin/**` only.

**Done when:** App routes can import from `@/lib/supply-chain-twin/...` with no circular deps.

---

## Slice 3 — Stub catalog API (~1.5–2 h)

**Goal:** First authenticated API + empty-state UI wired.

**Milestones**

- [ ] `GET /api/supply-chain-twin/entities?q=` — `{ items: [] }`, zod-validated query.
- [ ] Same auth/tenant pattern as an existing small API route.
- [ ] Client section on `/supply-chain-twin` (or subpage) that fetches and shows empty state.

**Paths (typical):** `src/app/api/supply-chain-twin/entities/`, `src/lib/supply-chain-twin/*`, small addition to `src/app/supply-chain-twin/`.

**Done when:** 200 + JSON in Network tab; 401/403 consistent with app for unauthenticated users.

---

## Slice 4 — Prisma persistence (~2 h)

**Goal:** Minimal table(s) aligned with upcoming graph spec.

**Milestones**

- [ ] Prisma model + migration (one table to start, e.g. tenant-scoped entity snapshot with JSON payload).
- [ ] `repo.ts` — `listForTenant(tenantId, …)`.
- [ ] Wire Slice 3 API to DB (may still return few rows).

**Paths:** `prisma/schema.prisma`, `prisma/migrations/**`, `src/lib/supply-chain-twin/**`, API route.

**Done when:** `db:migrate` applied; no Prisma runtime errors on the route.

---

## Slice 5 — Demo seed (~1 h)

**Goal:** Investor-visible non-empty list.

**Milestones**

- [ ] Script `npm run db:seed:supply-chain-twin-demo` (or guarded block in existing seed).
- [ ] One demo row for demo tenant.
- [ ] API returns ≥1 item; UI lists it.

**Paths:** `package.json` script, `prisma/*seed*`, `src/lib/supply-chain-twin/**`.

**Done when:** Document one command in this file’s footer or in `docs/database-neon.md` (one line).

---

## Slice 6 — Explorer route (~1.5–2 h)

**Goal:** Second PRD surface as structure (Twin explorer).

**Milestones**

- [ ] `GET` (or app route) `/supply-chain-twin/explorer` with layout shell.
- [ ] Table or cards bound to entities API; filters stubbed.
- [ ] In-page nav: Overview ↔ Explorer (links).

**Paths:** `src/app/supply-chain-twin/explorer/**`, optional small shared components under `src/components/supply-chain-twin/**`.

**Done when:** Deep-link works; no broken chrome.

---

## Slice 7 — Guardrails (~1 h)

**Goal:** Safe iteration post-demo.

**Milestones**

- [ ] Structured logging on API errors (no PII).
- [ ] Optional: update `docs/sctwin/supply_chain_twin_sprint_backlog_and_release_plan.md` with “M1–M7” status line.

**Paths:** API routes + tiny doc edit.

---

## Prompt template for the agent

```text
Follow docs/sctwin/agent_milestones_one_agent.md. Implement Slice N only.
Do not edit files outside the slice’s Paths unless blocked — then list the conflict and stop.
End with: tsc clean, and note any migration/seed commands for humans.
```

---

## Reference pack

Full product and technical specs live alongside this file under `docs/sctwin/` (README, PRD, data model, ingestion, permissions, etc.).
