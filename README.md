# PO Management

Internal operations app: **purchase orders**, **suppliers**, **catalog**, **consolidation**, **Control Tower** (logistics workbench and reporting), **CRM**, and **WMS**. Built with [Next.js](https://nextjs.org) (App Router), React 19, Prisma 7, PostgreSQL, and Tailwind CSS 4.

## Requirements

- **Node.js 22.x** (see `package.json` `engines`)

## Local setup

1. **Install dependencies** (runs `prisma generate` on `postinstall`):

   ```bash
   npm install
   ```

2. **Configure the database** in **`.env.local`** (gitignored). At minimum:

   ```bash
   DATABASE_URL="postgresql://..."
   ```

   For Neon URLs, credential hygiene, and optional `DATABASE_URL_UNPOOLED` / `DIRECT_URL`, see [docs/database-neon.md](docs/database-neon.md). A copy-paste flow using a local-only credentials file is described in [docs/neon-connection.local.example.md](docs/neon-connection.local.example.md).

3. **Apply migrations and seed** (from project root, with `DATABASE_URL` set):

   ```bash
   npm run db:migrate:local
   npm run db:seed
   ```

   Optional richer demo data:

   ```bash
   npm run db:seed:demo-full
   ```

   CRM-focused demo: [docs/crm/README.md](docs/crm/README.md).

4. **Run the dev server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Useful npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build (runs TypeScript check) |
| `npm run start` | Start production server after `build` |
| `npm run lint` | ESLint across the repository |
| `npm run db:migrate:local` | Local migrations (see script / docs) |
| `npm run db:seed` | Main Prisma seed |
| `npm run db:seed:demo-full` | Full demo seed pipeline |
| `npm run db:seed:ct-volume` | Large Control Tower shipment volume seed |
| `npm run db:seed:crm-demo` | CRM demo seed |
| `npm run db:ping` | Quick DB connectivity check |

## Optional environment variables

Names only (no secrets in git). Use `.env.local` for local development.

| Variable | Role |
|----------|------|
| `DATABASE_URL` | **Required** for Prisma and the app |
| `DATABASE_URL_UNPOOLED`, `DIRECT_URL` | Often used for migrations with Neon |
| `OPENAI_API_KEY` | Enables OpenAI-backed features when combined with flags below |
| `CONTROL_TOWER_ASSIST_LLM`, `OPENAI_CONTROL_TOWER_ASSIST_MODEL` | Control Tower assist |
| `CONTROL_TOWER_REPORT_INSIGHT_LLM`, `OPENAI_REPORT_INSIGHT_MODEL` | Saved report insight |
| `REPORTING_COCKPIT_LLM`, `OPENAI_REPORTING_COCKPIT_MODEL` | Reporting cockpit insight |
| `HELP_LLM`, `OPENAI_HELP_MODEL`, `OPENAI_HELP_DISABLED` | In-app help assistant |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for document uploads (production); dev may use local fallbacks |
| `CRON_SECRET` | Secures `/api/cron/*` routes when calling from a scheduler |
| `PO_ALLOW_UNAUTHENTICATED` | Set to `1` only for controlled demo / local open access |
| `DEMO_ACTOR_EMAIL` | Demo session actor override |
| `CONTROL_TOWER_FX_BASES`, `CONTROL_TOWER_FX_TARGETS` | FX refresh currency lists |
| `CONTROL_TOWER_SYSTEM_ACTOR_EMAIL` | System actor for SLA escalation |

## Product documentation

- **Tenancy / ICP:** [docs/icp-and-tenancy.md](docs/icp-and-tenancy.md)
- **CRM:** [docs/crm/README.md](docs/crm/README.md)
- **Database (Neon):** [docs/database-neon.md](docs/database-neon.md)
- **WMS / Control Tower PDFs** live under [docs/wms/](docs/wms/) and [docs/controltower/](docs/controltower/).

## Quality checks before pushing

- **`npm run build`** — recommended; runs the Next.js compile and TypeScript pass.
- **`npm run lint`** — ESLint for the whole tree (exits 0). A few `react-hooks/exhaustive-deps` warnings remain on large forms; tighten those when touching those files. For a narrow check: `npx eslint <path-to-files>`.

## Deploy

Vercel-oriented build entry: `npm run vercel-build` (see `scripts/vercel-build.cjs`). Set production secrets in the hosting provider; never commit `.env*` files.
