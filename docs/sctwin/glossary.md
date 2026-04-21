# Supply Chain Twin — glossary

Short definitions for terms used across twin specs and code. For build order and scope, see [README](./README.md).

## Core objects

**Entity snapshot**  
A tenant-scoped, persisted view of one logical supply-chain entity at a point in time (for example a site, lane, or SKU). It carries a stable primary key, a typed **reference** (`kind` + business `id`), and bounded JSON payload materialized from source systems — not a live mirror of every upstream field.

**Edge**  
A directed link between two entity snapshots in the twin graph (for example *supplies*, *ships_via*, *located_at*). Edges are tenant-scoped, carry minimal typed metadata, and support graph queries without loading full payloads.

**Ingest event**  
An append-only record that the twin (or an integration) **observed** something: a normalized `type`, optional structured `payload`, and `createdAt`. Events form the audit and replay spine; they are not a general-purpose message bus.

**Scenario draft**  
A tenant-scoped what-if container: human-readable `title`, workflow `status`, and a JSON **draft** graph or parameters for the scenario engine. Drafts are versioned in storage as rows; promotion to “run” or published scenarios is a separate lifecycle step.

**Risk signal**  
A tenant-scoped assessment row tied to the twin catalog (for example delay, capacity, or compliance risk) with a **severity** enum, optional linkage to entities/edges, and timestamps. Signals are read paths for overview and alerting; scoring rules live in KPI/risk specs.

**Readiness**  
A small, operator-safe snapshot of whether the twin preview can run in this environment: boolean `ok` plus `reasons[]` (migrations, tables, flags). It avoids leaking tenant names, SQL, or secrets in client-visible strings.
