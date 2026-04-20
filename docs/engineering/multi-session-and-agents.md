# Multi-session work and agents (safe defaults)

This repo is large (many modules). These rules keep **parallel chats/agents** and **Vercel deploys** predictable.

## When an agent looks “stuck” on a build

Commands like **`npm run build`** (`next build`) or **`npm run vercel-build`** can run **10+ minutes**. The agent may wait on the terminal.

**Do this:** use **Run in background** (or equivalent) for that command so the agent is not blocked. Check the terminal output when it finishes.

**Faster checks** (closer to GitHub CI, usually enough before a push):

```bash
npm run lint && npx tsc --noEmit && npm run test
```

CI on pull requests runs **lint → typecheck → test** (see `.github/workflows/ci.yml`). It does **not** run `next build`; Vercel still builds on deploy.

## One task, one branch, one pull request

- **One GitHub Issue** (or one clearly scoped request) ≈ **one branch** ≈ **one PR**.
- **Merge to `main`** when you are happy → Vercel deploys **arscmp.com** (per your setup).

Avoid one mega-prompt that touches CRM + Tower + Prisma at once; that causes merge pain.

## Database and seeds

- **Never run two `db:seed` (or heavy seeds) at the same time** on the same `DATABASE_URL`.
- **Do not** put “run seed” in every agent prompt. Only when the issue explicitly requires it **and** nobody else is seeding.

## Labels (GitHub) — optional but helpful

Create labels if you want filtering:

| Label        | Meaning                                      |
| ------------ | -------------------------------------------- |
| `now`        | Doing this soon                              |
| `agent-ok`   | Clear scope; safe to hand to an agent        |
| `needs-alex` | Needs your decision before anyone codes      |
| `module:*`   | e.g. `module:crm`, `module:tower` (optional) |

Use **Issues → New issue → “Agent task”** as a starting point.

## Multiple Cursor sessions

You **can** open several chats/sessions (local or cloud). Same rules as multiple people:

- Different **files/modules** → fewer conflicts.
- Same **hot files** (e.g. `prisma/schema.prisma`, global nav) → expect to **merge or sequence** work.

## What “safe” means here

1. **Small issues**, tight scope, link to `docs/...` for detail.  
2. **PR + review** before `main` if you care what goes live.  
3. **Background** long builds; use **fast checks** for quick feedback.
