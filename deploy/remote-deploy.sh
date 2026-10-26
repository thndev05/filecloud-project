#!/usr/bin/env bash
# Deploy from your machine (e.g. VS Code terminal): SSH into the VPS, pull, rebuild.
#   bash deploy/remote-deploy.sh
# Override target: DEPLOY_TARGET=user@host DEPLOY_URL=https://domain bash deploy/remote-deploy.sh
set -euo pipefail

TARGET="${DEPLOY_TARGET:-hoangnhat@filecloud.kun.id.vn}"
APP_DIR="${DEPLOY_DIR:-/opt/filecloud}"
URL="${DEPLOY_URL:-https://filecloud.kun.id.vn}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# The VPS pulls from GitHub, so local main must be pushed or it deploys old code
echo "==> Checking local branch is pushed"
git fetch -q origin
branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || { echo "On '$branch', switch to main first."; exit 1; }
[[ -z "$(git status --porcelain)" ]] || echo "Warning: uncommitted local changes will NOT be deployed."
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || {
  echo "Local main and origin/main differ. Push (or pull) first."; exit 1; }
echo "Deploying $(git log -1 --format='%h %s')"

echo "==> Deploying on $TARGET (sudo may ask for your VPS password)"
ssh -t "$TARGET" "cd $APP_DIR && git pull --ff-only && sudo bash deploy/deploy.sh"

echo "==> Health check (backend runs migrations on start, allow ~60s)"
for _ in $(seq 1 12); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL/api/health" || true)"
  [[ "$code" == "200" ]] && break
  sleep 5
done
if [[ "$code" == "200" ]]; then
  echo "OK: backend is up ($URL)"
else
  echo "Health check failed: $URL/api/health returned '$code' (expected 200)"
  echo "Check logs: ssh $TARGET 'cd $APP_DIR && sudo docker compose logs --tail=50 backend'"
  exit 1
fi
