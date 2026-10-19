#!/usr/bin/env bash
# Build images and (re)start the stack. Run after every `git pull`:
#   sudo bash deploy/deploy.sh
# The backend container applies Prisma migrations itself on start.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
