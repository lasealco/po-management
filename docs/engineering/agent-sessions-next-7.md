# Next seven agent sessions (longer slices)

Use these as **seven separate Cursor chats** (or cloud agents), **one session = one branch = one PR**. Target **~45–75 minutes of focused implementation** per session (wall time varies with CI and how much you expand scope).

**Parallel rule:** only run sessions **in parallel** when they touch **different module paths** (see each session’s allowed paths). Do not run two sessions that both edit the same hot files (for example `prisma/schema.prisma`).

**Database:** do **not** run `db:seed` / heavy seeds unless the session explicitly allows it. `db:migrate` only when the session says Prisma/migrations are in scope.

**Quality gate before push:** at minimum  
`npm run lint && npx tsc --noEmit && npm run test`  
Add the session’s extra script (for example `npm run verify:tariff-engine`) when listed.

---

## Master copy-paste prompt (fill placeholders per session)

```text
Repo: lasealco/po-management (this workspace).

SESSION: <paste session title from docs/engineering/agent-sessions-next-7.md>
GitHub issue: #<N> (read full body + every comment before coding).

Rules:
- Implement THIS issue only; stay inside the allowed paths in the issue (and this doc).
- Branch from latest main: git fetch origin main && git switch -c <branch-name> origin/main
- One PR to main; do NOT merge — Alex merges after review.
- Do NOT run db:seed or db:migrate unless the issue explicitly says so.
- If blocked (ambiguous product, needs secrets, migration not approved), stop and ask Alex with a short question.

Done when:
- All acceptance checkboxes for the issue are satisfied (or you list what is intentionally out of scope with reason).
- npm run lint && npx tsc --noEmit && npm run test pass (plus verify script if the issue names one).
- PR description links the issue; use "Closes #N" only if Alex wants auto-close on merge.

Push + open PR with a clear title. If CI is red, fix or report the failing log snippet.
```

Replace `<branch-name>` with something like `session/13-srm-meeting`, `session/5-tower-reports`, etc.

---

## Session 1 — SRM meeting batch (open epic)

| Field | Value |
|--------|--------|
| **GitHub** | [#13](https://github.com/lasealco/po-management/issues/13) |
| **Time target** | ~60–90 min (full meeting issue; can split into two PRs **only** if you first comment on #13 with the split plan). |
| **Doc** | Issue body + [`agent-todos/srm.md`](./agent-todos/srm.md) |
| **Typical paths** | `src/app/srm/**`, `src/lib/srm/**`, `src/app/suppliers/**` when SRM-scoped, SRM-related `src/app/api/**` as named in issue |
| **Verify** | `npm run lint && npx tsc --noEmit && npm run test` |

**Starter prompt:** use the master block with `GitHub issue: #13`.

---

## Session 2 — Control Tower inbound webhook tests (finish or close)

| Field | Value |
|--------|--------|
| **GitHub** | [#4](https://github.com/lasealco/po-management/issues/4) |
| **Time target** | ~30–45 min |
| **Note** | Much of this landed with [#9](https://github.com/lasealco/po-management/issues/9) (`src/lib/control-tower/inbound-webhook.test.ts` already exists). Agent should **re-read #4 acceptance**, add **any missing** cases (idempotency replay + batch cap edge cases), or **comment on #4** with evidence and open a tiny docs-only PR that checks off GAP references—**do not duplicate** existing tests. |
| **Typical paths** | `src/lib/control-tower/inbound-webhook.ts`, `src/lib/control-tower/inbound-webhook.test.ts`, `docs/controltower/GAP_MAP.md` if needed |
| **Verify** | `npm run lint && npx tsc --noEmit && npm run test` |

**Starter prompt:** use the master block with `GitHub issue: #4`.

---

## Session 3 — Control Tower report engine (phase 1)

| Field | Value |
|--------|--------|
| **GitHub** | [#5](https://github.com/lasealco/po-management/issues/5) |
| **Time target** | ~60–75 min |
| **Doc** | Latest **comments** on #5 (dimension / exception row rules) + [`agent-todos/control-tower.md`](./agent-todos/control-tower.md) |
| **Typical paths** | `src/app/control-tower/**`, `src/app/api/control-tower/**`, `src/lib/control-tower/**`, `src/components/control-tower-*.tsx` |
| **Verify** | `npm run lint && npx tsc --noEmit && npm run test` |

**Starter prompt:** use the master block with `GitHub issue: #5`.

---

## Session 4 — CRM: Account workspace “360” shell

**GitHub:** file a new issue first (Agent task), then run the session.

**Suggested issue title:** `feat(crm): account workspace 360 shell (placeholder panels)`

**Suggested body (paste into GitHub):**

```markdown
## Goal
Tabbed **Account** workspace with **placeholder** panels for shipments/finance (no real integrations yet).

## Allowed paths
- `src/app/crm/accounts/**`, `src/app/api/crm/**`, `src/lib/crm/**`
- CRM-scoped components under `src/components/**` only if clearly tied to this page

## Out of scope
- Control Tower, WMS, tariff, new Prisma models unless explicitly needed for routing

## Acceptance
- [ ] `/crm/accounts/[id]` (or agreed route) shows a **360-style** layout: tabs + placeholder copy per tab
- [ ] Respects existing CRM auth grants (`org.crm` view/edit) consistent with other CRM pages
- [ ] No broken navigation from accounts list into the new shell

## Verify
`npm run lint && npx tsc --noEmit && npm run test`
```

**Time target:** ~50–70 min.

**Starter prompt:** master block with `GitHub issue: #<your new issue number>`.

---

## Session 5 — WMS: Saved ledger views (filters)

**GitHub:** file a new issue first.

**Suggested title:** `feat(wms): persist stock ledger list filters / saved views`

**Suggested body:**

```markdown
## Goal
Let users **save and re-apply** a named filter preset for the stock movement ledger (minimal v1: localStorage **or** server prefs—pick one in implementation and document in PR).

## Allowed paths
- `src/app/wms/**`, `src/app/api/wms/**`, `src/lib/wms/**`, WMS-scoped components per issue

## Out of scope
- CRM, tariff, unrelated Prisma domains

## Acceptance
- [ ] User can save a view name + current filter state and reload it later
- [ ] Clear UX for “current view” vs default
- [ ] `docs/wms/GAP_MAP.md` one-line note under relevant row (Last updated)

## Verify
`npm run lint && npx tsc --noEmit && npm run test`
```

**Time target:** ~60–80 min (if server prefs need API, stay small; prefer localStorage v1 to fit the window).

**Starter prompt:** master block with the new issue number.

---

## Session 6 — Tariff: import promote edge cases + tests

**GitHub:** file a new issue first.

**Suggested title:** `test(tariff): promote import edge cases + API error parity`

**Suggested body:**

```markdown
## Goal
Harden `promote` / staging import path: edge cases + Vitest coverage; align API error shapes with existing tariff API helpers where touched.

## Allowed paths (strict)
Per `.cursor/rules/tariff-engine-scope.mdc`: `src/lib/tariff/**`, `src/app/api/tariffs/**`, related `src/app/tariffs/**` / `src/components/tariffs/**` only if required

## Out of scope
- Unrelated modules, invoice-audit unless strictly needed for promote errors

## Acceptance
- [ ] New or extended tests in `src/lib/tariff/**` covering agreed edge cases (list in PR)
- [ ] `npm run verify:tariff-engine` passes

## Verify
`npm run lint && npx tsc --noEmit && npm run test && npm run verify:tariff-engine`
```

**Time target:** ~50–70 min.

**Starter prompt:** master block with the new issue number and remind `verify:tariff-engine` in the prompt.

---

## Session 7 — Sales orders: PATCH detail API + error tests

**GitHub:** file a new issue first.

**Suggested title:** `feat(sales-orders): tighten PATCH /api/sales-orders/[id] errors + tests`

**Suggested body:**

```markdown
## Goal
Tighten `GET/PATCH` behavior for `src/app/api/sales-orders/[id]/route.ts`: consistent JSON errors, guards, and Vitest for any extracted pure parsers (if small).

## Allowed paths
- `src/app/api/sales-orders/**`, `src/app/sales-orders/**`, `src/components/sales-order*.tsx`, `src/lib/sales-orders/**`

## Out of scope
- Tariff, CRM, Control Tower, WMS

## Acceptance
- [ ] PATCH/GET error responses are predictable (status codes + `{ error: string }` or existing app convention)
- [ ] Tests added where pure logic is extracted; or route-level tests if repo pattern exists
- [ ] `org.orders` grants unchanged semantically (only clearer errors)

## Verify
`npm run lint && npx tsc --noEmit && npm run test`
```

**Time target:** ~45–65 min.

**Starter prompt:** master block with the new issue number.

---

## Quick start order (suggested)

1. **File GitHub issues** for sessions **4–7** (paste bodies above).  
2. Run **Session 2** early if you want noise cleared (#4 vs existing tests).  
3. Run **#13** when you have bandwidth (largest).  
4. Keep **#5** as its own chat (easy to underestimate).  
5. **CRM / WMS / Tariff / Sales orders** sessions can run **in parallel** only in pairs that do not overlap paths (for example **Session 4 + Session 6** OK; **Session 6 + anything in tariff + invoice-audit** — stay in tariff scope only).

---

## Related docs

- [`multi-session-and-agents.md`](./multi-session-and-agents.md) — branches, seeds, CI vs `next build`  
- [`meeting-epics/README.md`](./meeting-epics/README.md) — original meeting-batch table  
- [`agent-todos/README.md`](./agent-todos/README.md) — per-module checkbox queues  
