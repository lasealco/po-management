# BF-49 — Operational timeline / unified audit feed

**Goal:** One **read-only tenant timeline** that blends **Control Tower** **`CtAuditLog`** rows, **WMS** **`InventoryMovement`** ledger postings, and **dock yard milestones** derived from **`WmsDockAppointment`** timestamps — for executive / ops surfaces without SIEM scope.

## API

- **`GET /api/control-tower/timeline`**
  - **Auth:** **`org.controltower` → view** **or** **`org.wms` → view** (`requireAnyApiGrant`).
  - **Query:** **`limit`** (1–100, default 40), **`cursor`** (opaque keyset), **`sources`** (comma list: `ct_audit`, `inventory_movement`, `dock_milestone`; default all).
  - **Response:** `{ events[], nextCursor, limit, sources[] }` — each event has **`kind`**, **`occurredAt`**, **`title`**, **`detail`** (object).

## Implementation

- **`src/lib/operations/tenant-operations-timeline.ts`** — UNION ALL merge + keyset cursor (`t`, `sk`, `id`) + Vitest.
- **`src/components/operational-timeline-feed.tsx`** — client stub mounted on **`/control-tower`** and **`/wms`** home pages.

## Sorting

Newest first; tie-break **`sk`** (`ct_audit` > `inventory_movement` > `dock_milestone`) then **`id`** so pagination is stable.

## Out of scope

SIEM export, long-retention archival, external PDP filters on payload bodies.
