# Neon database (demo / development)

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
