#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
exec 9>"${TMPDIR:-/tmp}/stars-connect-deploy.lock"
flock -n 9 || { echo "Another STARS Connect deployment is already running."; exit 1; }
if [[ -f .env ]]; then set -a; source .env; set +a; fi
echo "Creating pre-deployment database backup..."
node scripts/backup-database.mjs
echo "Fetching latest main branch..."
git fetch origin main
git checkout main
git merge --ff-only origin/main
export GIT_COMMIT_SHA="$(git rev-parse --short HEAD)"
# Production is the runtime mode, but Next.js still needs devDependencies
# such as Tailwind/PostCSS while compiling the production bundle.
npm ci --include=dev --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart stars-connect --update-env
pm2 save
echo "Deployment complete: $GIT_COMMIT_SHA"