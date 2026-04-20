# API hub — spec ↔ codebase gap map

**Legend:** ✅ shipped · 🟡 partial / stub · ❌ not started

**Last updated:** (set when the first API hub PR merges)

| Area | Repo reality | Notes |
|------|--------------|--------|
| Docs home | 🟡 `docs/apihub/README.md`, specs | This folder |
| Ingestion spec | 🟡 `integrations-ai-assisted-ingestion.md` | Draft; evolves with P0–P4 |
| App route `/apihub` | ❌ | P0 shell target |
| Health / discovery API | ❌ | e.g. `GET /api/apihub/health` |
| Prisma: connector / template / batch | ❌ | P1 |
| AI job + mapping editor | ❌ | P2 |
| Deterministic apply + idempotent API | ❌ | P3 |

## Near-term build order

1. P0 — shell + health + docs links (see meeting-batch issue).
2. P1 — data model + CRUD stubs.
3. P2 — jobs + editor + staging preview.
4. P3 — production apply + CT/PO/SO wiring per scenario.
5. P4 — conflicts, match keys, hardening.
