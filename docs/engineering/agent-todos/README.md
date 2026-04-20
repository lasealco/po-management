# Agent todo lists (per module)

These files turn **module backlogs** into **checkbox queues** for Cursor (or cloud) agents. They are **not** a promise every box ships next sprint — they keep work visible and **scoped**.

## How to use

1. **Pick one module file** below (e.g. `crm.md`).
2. **Choose the next unchecked row** (or a small group of adjacent rows you want in one PR).
3. **Open a GitHub issue** (template: **Agent task**) with:
   - Link to this file + the **exact heading / line** you want done,
   - **Allowed paths** (copy from the module file’s *Scope* section),
   - Labels: `module:…`, `now`, `agent-ok` when ready.
4. **New Cursor chat** → paste the [master prompt](https://github.com/lasealco/po-management/blob/main/docs/engineering/multi-session-and-agents.md) rules + **issue number**.

**Parallel agents:** only run **different modules** (or non-overlapping paths) at the same time. Two agents must not edit the **same file** without coordination.

**Seeds:** only when an issue explicitly says so — **one seed-related issue active at a time** on a shared database.

## Index

| File | Module | Primary backlog source |
|------|--------|-------------------------|
| [control-tower.md](./control-tower.md) | Control Tower | `docs/controltower/GAP_MAP.md` + GitHub issues |
| [crm.md](./crm.md) | CRM | `docs/crm/BACKLOG.md` |
| [wms.md](./wms.md) | WMS | `docs/wms/GAP_MAP.md` |
| [srm.md](./srm.md) | SRM | `docs/srm/*.pdf` + current `/srm` app |
| [tariff.md](./tariff.md) | Tariff / rates audit | `src/lib/tariff`, `src/app/tariffs`, rules in `.cursor/rules/tariff-engine-scope.mdc` |
| [system.md](./system.md) | Cross-cutting (tenancy, RBAC, org) | `docs/icp-and-tenancy.md` |
| [integration-hub.md](./integration-hub.md) | API hub / integration (P0+) | Spec: [`docs/apihub/`](../apihub/README.md) |
| [sales-orders.md](./sales-orders.md) | Sales orders (`org.orders`) | `SalesOrder` hub + APIs (not tariff pricing) |

## Related

- [Multi-session and agents](../multi-session-and-agents.md) — branches, seeds, CI checks.
- [Meeting-batch epics](../meeting-epics/README.md) — **~2h+** scoped GitHub issues for parallel agents.
- [Next seven agent sessions](../agent-sessions-next-7.md) — **follow-on** 45–75 min slices + copy-paste prompts (after meeting batches).
