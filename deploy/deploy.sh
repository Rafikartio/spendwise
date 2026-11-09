#!/usr/bin/env bash
# Run on the EC2 server from anywhere:  bash deploy/deploy.sh
# Pulls latest code, installs, builds the React app and (re)starts the API with PM2.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f server/.env ]; then
  echo "ERROR: server/.env is missing. Copy deploy/env.production.example to server/.env and fill it in." >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm install --prefix server --omit=dev
npm install --prefix client

echo "==> Building client"
npm run build --prefix client

echo "==> Restarting app"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Done. Health check:"
sleep 2
curl -fsS http://127.0.0.1:4000/api/health && echo
