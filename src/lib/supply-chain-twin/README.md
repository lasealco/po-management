# `supply-chain-twin` library

## Scope

Shared **types**, **constants**, and small **helpers** for the Supply Chain Twin preview and APIs. Aligned with the specs under `docs/sctwin/`.

## Non-goals

- No Prisma or DB access in this folder (persistence lives elsewhere).
- No UI components (use `src/components/supply-chain-twin/**` when that exists).
- No cross-module refactors of PO, WMS, CRM, etc.

## Specs

Start with the developer pack overview: [`docs/sctwin/README.md`](../../../docs/sctwin/README.md).
