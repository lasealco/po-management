---
name: Agent task
about: One scoped piece of work for a developer or AI agent
title: "[module] "
---

## Goal (one sentence)


## Acceptance criteria

- [ ]
- [ ]

## Scope (paths or areas)

Allowed / focus (e.g. `src/app/crm/`, one API route):

Do **not** change (unless this issue says so):

## Database / seed

- [ ] No database or seed work
- [ ] Migrations / schema (describe)
- [ ] Seed (which script; **only one seed at a time** on shared DB)

## Links

- Doc / backlog reference:

## Verify (pick what matches the change)

- Default: `npm run lint && npx tsc --noEmit && npm run test`
- Tariff slice: `npm run verify:tariff-engine` (if touching tariffs / invoice-audit / pricing snapshots)
- Full production build: `npm run build` (slow — run **in background** in agent UI if needed)
