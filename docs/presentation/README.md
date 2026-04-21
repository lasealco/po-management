# Presentation assets — database / domain model

Use these in meetings with backend specialists. **Canonical schema** remains [`../../prisma/schema.prisma`](../../prisma/schema.prisma) (PostgreSQL, Prisma ORM).

## Quick paths

| Asset | Purpose |
| --- | --- |
| [`database-model-overview.mmd`](./database-model-overview.mmd) | **High-level ERD** (Mermaid) — major entities and flows only |
| [`database-model-overview.png`](./database-model-overview.png) | **Same ERD as PNG** (slide-ready; regenerate after editing the `.mmd`) |
| [`MODEL-CATALOG.md`](./MODEL-CATALOG.md) | **Full model list** grouped by product area (regenerate with script below) |
| `prisma/schema.prisma` (repo root) | **Every** table, field, index, and relation |

## Export a diagram image (PNG / SVG)

1. Open **[Mermaid Live Editor](https://mermaid.live)**.
2. Paste the contents of `database-model-overview.mmd`.
3. **Actions → PNG** or **SVG** for your slides.

CLI alternative (needs a local Chromium for headless render):

```bash
npx --yes @mermaid-js/mermaid-cli -i docs/presentation/database-model-overview.mmd -o docs/presentation/database-model-overview.png
```

## Regenerate the model catalog table

From the repository root:

```bash
node scripts/generate-presentation-model-catalog.mjs
```

## Optional: full SQL DDL

If they want raw PostgreSQL DDL (not Prisma), generate from a migrated database, for example:

```bash
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges > docs/presentation/schema-ddl-from-db.sql
```

(Use a **non-production** URL; do not commit secrets or production dumps.)
