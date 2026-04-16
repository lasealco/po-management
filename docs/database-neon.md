# Neon database (demo / development)

## Start here (so nothing gets “lost” again)

- **One-shot migrate + full demo stack:** step-by-step in [`docs/neon-connection.local.example.md`](./neon-connection.local.example.md) — command is `npm run db:seed:demo-full` (or `-- --skip-migrate` if schema is already current).
- **Where the Neon “Copy snippet” line lives in-repo:** `docs/neon-credentials.local.md` — **gitignored** (never committed). Create it by copying [`docs/neon-connection.local.example.md`](./neon-connection.local.example.md) or [`docs/neon-credentials.local.md.example`](./neon-credentials.local.md.example), then paste one `postgresql://…` line.
- **Day-to-day Next.js / Prisma:** `.env.local` at the repo root is fine; `seed-demo-full` and `db:migrate` can use either env **or** that doc file (see script comments).

## Where the connection string lives

Real URLs and passwords must **not** be committed to git.

- **Local only (gitignored):** `docs/neon-credentials.local.md` — create this file on your machine (see template below). It is listed in `.gitignore`.
- **Template (safe to commit):** `neon-credentials.local.md.example` in this folder — copy to `neon-credentials.local.md` and fill in your values.

## Using the URL with this repo

From the project root, with Node 22+:

```bash
export DATABASE_URL="paste-from-neon-credentials-local.md"
# Optional: Neon direct host for migrations (see Neon + Prisma docs)
# export DATABASE_URL_UNPOOLED="..."

npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

Optional full CRM demo bulk (in addition to main seed):

```bash
SEED_CRM_DEMO=1 npm run db:seed
```

## Security checklist

1. **Rotate credentials** in the [Neon console](https://console.neon.tech) if the URL was ever pasted into chat, a ticket, or a shared doc. Treat that copy as exposed.
2. Prefer **`.env.local`** (already gitignored) for day-to-day local dev; use `docs/neon-credentials.local.md` only as a short-lived scratch pad if you want it in-repo but ignored.
3. Before making the repo public or sharing widely, delete `neon-credentials.local.md` and rely solely on env vars.
