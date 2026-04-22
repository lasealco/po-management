# Tariff / rates / invoice-audit slice — agent todo list

**GitHub label:** `module:tariff`  
**Allowed paths (strict — see repo rule):** `src/lib/tariff/**`, `src/app/tariffs/**`, `src/app/api/tariffs/**`, `src/components/tariffs/**`, `src/lib/rfq/**`, `src/app/rfq/**`, `src/app/api/rfq/**`, `src/components/rfq/**`, `src/lib/booking-pricing-snapshot/**`, `src/app/api/booking-pricing-snapshots/**`, `src/lib/invoice-audit/**`, `src/app/invoice-audit/**`, `src/app/api/invoice-audit/**`, `src/components/invoice-audit/**`, `src/components/pricing-snapshots/**`, `src/app/pricing-snapshots/**` — **only** when the issue is clearly in this vertical.  
**Verify:** `npm run verify:tariff-engine` for substantive changes (per `.cursor/rules/tariff-engine-scope.mdc`).

There is no single `docs/tariff/GAP_MAP.md` yet; backlog is spread across contracts UI, import pipeline, geography, rating, legal entities, invoice audit. Use **small issues** per vertical subdirectory.

**Tariffs REST index:** [`docs/engineering/tariff-engine/API_ROUTE_INDEX.md`](../tariff-engine/API_ROUTE_INDEX.md) — grouped listing of all `/api/tariffs` route handlers.

**Parallel batches (60 slices, 3 tracks × 20):** [`docs/engineering/tariff-engine/BATCH_BACKLOG.md`](../tariff-engine/BATCH_BACKLOG.md) — file ownership skew so three agents can run a wave without constant merges. *(Note: `docs/tariff/` is gitignored in this repo; backlog lives under `docs/engineering/tariff-engine/`.)*

**AI + uploads (products, ASN, ocean/truck/air/LCL docs):** product framing and guardrails live in **`docs/apihub/ai-upload-playbook-catalog-tariffs.md`** (extraction vs deterministic rating; staging/promote pattern).

---

## Ongoing hygiene (after large merges)

- [ ] Confirm **migrations** on shared DB are applied where you deploy; issues should say whether `db:migrate` is allowed (never combine with unapproved **seed**).
- [ ] **Import pipeline** — promote flow edge cases + tests (`src/lib/tariff/promote-staging-import.ts`, API promote routes).
- [ ] **Geography catalog** — drift between seed/reference JSON and UI catalog checks.
- [ ] **Rating engine** — add regression tests when changing `rating-engine.ts`.
- [ ] **Shipment tariff applications** — API + UI alignment with `shipment-tariff-applications.ts`.
- [ ] **Investor / demo** — keep demo seeds idempotent; document which script in the issue body if seeding is required.

---

## Product expansions (split into issues — do not boil the ocean)

- [ ] **Contract version UX** — guided steps / polish per workflow design system.
- [ ] **Rate lookup** — investor door rates + public-safe copy.
- [ ] **Reference data** — airlines/countries/ocean carriers admin QA pass.
- [ ] **Invoice audit** — intake flows only when tied to snapshots (stay in scope doc above).
