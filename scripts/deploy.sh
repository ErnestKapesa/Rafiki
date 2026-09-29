#!/usr/bin/env bash
# One-shot production deploy for Rafiki → Vercel.
# Run from the repo root on YOUR machine:   bash scripts/deploy.sh
# It reads your keys from .env (or from a filled-in .env.example), pushes them to
# Vercel's Production environment, and deploys. Keys never touch git.
set -euo pipefail
cd "$(dirname "$0")/.."

VARS=(NEBIUS_API_KEY NEBIUS_BASE_URL MODEL_FAST MODEL_SMART MODEL_DEEP TAVILY_API_KEY VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY)
REQUIRED=(NEBIUS_API_KEY TAVILY_API_KEY)

# 1. Make sure keys live in .env (git-ignored), not in the public .env.example.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
fi
if grep -qE '^(NEBIUS_API_KEY|TAVILY_API_KEY|VITE_SUPABASE_ANON_KEY)=[^ #]+' .env.example; then
  echo "⚠️  .env.example contains real keys — it is committed to a PUBLIC repo."
  read -r -p "   Copy it to .env and restore the empty template? [Y/n] " ans
  if [[ "${ans:-Y}" =~ ^[Yy]$ ]]; then
    cp .env.example .env
    git checkout -- .env.example 2>/dev/null || true
    echo "✓ Keys moved to .env; .env.example is a clean template again"
  fi
fi

# Read KEY=VALUE from .env (ignores comments, inline " # …" and quotes).
val() {
  local line
  line=$(grep -E "^$1=" .env | tail -1 || true)
  line=${line#*=}
  line=${line%%[[:space:]]#*}
  line=${line%\"}; line=${line#\"}; line=${line%\'}; line=${line#\'}
  printf '%s' "$line" | sed -E 's/[[:space:]]+$//'
}

for k in "${REQUIRED[@]}"; do
  if [ -z "$(val "$k")" ]; then echo "✘ $k is empty in .env — fill it in and re-run."; exit 1; fi
done

# 2. Vercel login + project link (interactive the first time).
VERCEL="npx --yes vercel@latest"
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login
[ -f .vercel/project.json ] || $VERCEL link

# 3. Push env vars to Production (replacing old values).
for k in "${VARS[@]}"; do
  v=$(val "$k")
  [ -z "$v" ] && { echo "· skip $k (empty)"; continue; }
  $VERCEL env rm "$k" production -y >/dev/null 2>&1 || true
  printf '%s' "$v" | $VERCEL env add "$k" production >/dev/null
  echo "✓ $k"
done

# 4. Deploy.
$VERCEL --prod

echo
echo "🪐 Deployed! Verify in your browser:"
echo "   1. <your-url>/api/health  → \"mock\": false and three Nemotron models"
echo "   2. <your-url>             → hatch Rafiki and ask a question"
echo "   Supabase: run the migration + enable Anonymous sign-ins (see DEPLOY.md) for cloud saves."
