# SRM Markdown sidecars

Markdown mirrors of the SRM PDF pack, optimized for **Cursor / LLM** reading and ripgrep.

## Rules

- Spec content uses stable names: `srm_<topic>.md` (**no** embedded export date in the filename).
- **Authoritative printable sources** remain the PDFs in **`../pdf/`**. When the two diverge, treat **code + `prisma/schema.prisma`** as implementation truth and refresh these sidecars or the PDFs intentionally.

See **`../README.md`** for the full layout and PDF ↔ Markdown pairing table.

**Prisma (SRM migration order):** [`../SRM_MIGRATIONS.md`](../SRM_MIGRATIONS.md)

**Application library (`src/lib/srm`):** [`../../src/lib/srm/README.md`](../../src/lib/srm/README.md)
