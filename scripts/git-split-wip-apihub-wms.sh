#!/usr/bin/env bash
# Split mixed local work into named stashes (API hub vs WMS) so you can
# `git switch` branches and apply the right stash by message.
#
# Usage (repo root):
#   bash scripts/git-split-wip-apihub-wms.sh
#
# Safe: only runs `git stash push`; does not drop stashes or force checkout.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 1
fi

has_changes_under() {
  local p="$1"
  git status --porcelain -- "$p" 2>/dev/null | grep -q .
}

stash_if_any() {
  local msg=$1
  shift
  local candidates=("$@")
  local targets=()
  local p

  for p in "${candidates[@]}"; do
    if has_changes_under "$p"; then
      targets+=("$p")
    fi
  done

  if ((${#targets[@]} == 0)); then
    echo "— Nothing to stash for: $msg"
    return 0
  fi

  echo "Stashing (${#targets[@]} path group(s)): $msg"
  git stash push -u -m "$msg" -- "${targets[@]}"
}

echo "Current branch: $(git branch --show-current)"
echo "Working tree before split:"
git status -sb || true
echo

# Order: stash API hub first, then WMS, then anything else still dirty.
APIHUB_PATHS=(
  "docs/apihub"
  "docs/engineering/agent-todos/integration-hub.md"
  "src/app/layout.tsx"
  "src/components/command-palette.tsx"
  "src/app/apihub"
  "src/app/api/apihub"
  "src/lib/apihub"
)

WMS_PATHS=(
  "src/components/wms-client.tsx"
  "src/lib/wms/stock-ledger-url.ts"
  "src/lib/wms/stock-ledger-url.test.ts"
  "src/lib/wms/get-wms-payload.ts"
  "src/lib/wms/movement-ledger-query.ts"
)

stash_if_any "SPLIT-WIP api hub issue 16" "${APIHUB_PATHS[@]}"
stash_if_any "SPLIT-WIP wms issue 11" "${WMS_PATHS[@]}"

if git status --porcelain | grep -q .; then
  echo
  echo "Stashing leftover paths (not in API hub / WMS lists above)…"
  git stash push -u -m "SPLIT-WIP misc leftover $(date -u +%Y%m%d-%H%M%SZ)"
fi

echo
echo "Done. Status:"
git status -sb || true
echo
cat <<'EOF'
Next steps (copy one block only):

  API hub branch (#16):
    git switch issue/16-apihub-p0-meeting-batch
    git stash apply 'stash^{/SPLIT-WIP api hub issue 16}'

  WMS branch (#11):
    git switch issue-11-wms-stock-ledger-ux
    git stash apply 'stash^{/SPLIT-WIP wms issue 11}'

  If you also had a "misc leftover" stash:
    git stash list | head -n 8
    git stash apply stash@{N}    # pick the right one

After things look right: git stash drop   # only for the stash you applied and no longer need
EOF
