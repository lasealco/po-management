#!/usr/bin/env bash
# Loads DATABASE_URL (and optional DATABASE_URL_UNPOOLED) from .env.local, then runs Prisma migrate deploy.
# Use this instead of pasting multi-line export snippets (inline # comments can break zsh/bash parsing).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then
  echo "db-migrate-local: missing .env.local in project root" >&2
  exit 1
fi
# Drop any broken DATABASE_* from the parent shell so .env.local is authoritative.
unset DATABASE_URL DATABASE_URL_UNPOOLED DIRECT_URL 2>/dev/null || true
set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "db-migrate-local: DATABASE_URL is empty after loading .env.local" >&2
  exit 1
fi

# Docs often use "…" (Unicode ellipsis) as a placeholder. Prisma then tries to connect to host %E2%80%A6.
if [[ "$DATABASE_URL" == *"%E2%80%A6"* ]] || printf "%s" "$DATABASE_URL" | LC_ALL=C grep -qF "$(printf "\xe2\x80\xa6")"; then
  echo "db-migrate-local: DATABASE_URL still looks like a placeholder (ellipsis … or %E2%80%A6)." >&2
  echo "Paste the full connection string from Neon Dashboard → Connect, or Vercel → Storage / env vars (host like ep-xxxx.region.aws.neon.tech)." >&2
  exit 1
fi

echo "db-migrate-local: checking TCP + auth (npm run db:ping)…" >&2
if ! npm run db:ping; then
  echo "" >&2
  echo "db-migrate-local: db:ping failed — fix .env.local or network, then run: npm run db:migrate:local" >&2
  exit 1
fi

# Some networks resolve Neon to an unreachable IPv6; Node's `pg` and Prisma's
# engine can behave differently — prefer IPv4 for the migrate step.
if [[ -n "${NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="$NODE_OPTIONS --dns-result-order=ipv4first"
else
  export NODE_OPTIONS="--dns-result-order=ipv4first"
fi

# Neon cold starts can exceed Prisma's default connect window; `pg` may still succeed first.
_pg_append_query_param() {
  local url="$1"
  local key="$2"
  local val="$3"
  [[ -z "$url" ]] && return 0
  if [[ "$url" == *"${key}="* ]]; then
    printf "%s" "$url"
    return 0
  fi
  if [[ "$url" == *\?* ]]; then
    printf "%s" "${url}&${key}=${val}"
  else
    printf "%s" "${url}?${key}=${val}"
  fi
}
if [[ -n "${DATABASE_URL_UNPOOLED:-}" ]]; then
  export DATABASE_URL_UNPOOLED="$(_pg_append_query_param "$DATABASE_URL_UNPOOLED" connect_timeout 60)"
fi
if [[ -n "${DIRECT_URL:-}" ]]; then
  export DIRECT_URL="$(_pg_append_query_param "$DIRECT_URL" connect_timeout 60)"
fi
if [[ -n "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="$(_pg_append_query_param "$DATABASE_URL" connect_timeout 60)"
fi

# Prisma’s Rust query engine sometimes cannot open TCP to Neon’s *direct* host while Node `pg`
# succeeds. Neon’s *pooler* host often works for migrate when PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1.
_neon_pooler_fallback_url() {
  local u="$1"
  [[ -z "$u" ]] && return 0
  [[ "$u" != *".aws.neon.tech"* ]] && {
    printf "%s" "$u"
    return
  }
  [[ "$u" == *"-pooler."* ]] && {
    printf "%s" "$u"
    return
  }
  if [[ "$u" =~ @ep-([a-z0-9-]+)\. ]]; then
    local id="${BASH_REMATCH[1]}"
    if [[ "$id" != *-pooler ]]; then
      local seg="ep-${id}"
      u="${u/@${seg}\./@${seg}-pooler.}"
    fi
  fi
  printf "%s" "$u"
}

_apply_pooler_to_prisma_env() {
  local eff="${DATABASE_URL_UNPOOLED:-${DIRECT_URL:-$DATABASE_URL}}"
  local pool
  pool="$(_neon_pooler_fallback_url "$eff")"
  [[ "$pool" == "$eff" ]] && return 1
  echo "db-migrate-local: retrying migrate with Neon *-pooler* host (Prisma engine workaround)…" >&2
  if [[ -n "${DATABASE_URL_UNPOOLED:-}" ]]; then
    export DATABASE_URL_UNPOOLED="$pool"
  elif [[ -n "${DIRECT_URL:-}" ]]; then
    export DIRECT_URL="$pool"
  else
    export DATABASE_URL="$pool"
  fi
  return 0
}

set +e
npm run db:migrate
code=$?
set -e

if [[ "$code" -ne 0 ]] && _apply_pooler_to_prisma_env; then
  set +e
  npm run db:migrate
  code=$?
  set -e
fi

if [[ "$code" -ne 0 ]]; then
  echo "" >&2
  echo "db-migrate-local: Prisma engine could not connect (P1001). Trying SQL migrations via node-pg (same as db:ping)…" >&2
  if npm run db:migrate:pg; then
    echo "" >&2
    echo "db-migrate-local: Prisma’s engine could not open TCP from here, but migration state was synced with node-pg (same stack as db:ping). New SQL was applied if anything was pending; otherwise the DB was already up to date." >&2
    exit 0
  fi
  echo "" >&2
  echo "db-migrate-local: pg fallback also failed. If you saw Prisma P1001:" >&2
  echo "  • Neon: SQL Editor → run SELECT 1; check IP allowlist / password." >&2
  echo "  • Network: try another Wi‑Fi or phone hotspot (port 5432)." >&2
  echo "  • Manual fallback: npm run db:migrate:pg" >&2
fi
exit "$code"
