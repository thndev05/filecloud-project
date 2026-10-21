#!/usr/bin/env bash
# Build images and (re)start the stack. Run after every `git pull`:
#   sudo bash deploy/deploy.sh
# The backend container applies Prisma migrations itself on start.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Build one image at a time: parallel tsc builds exhaust RAM on a 1 GB VPS
docker compose build backend
docker compose build frontend
docker compose up -d
docker image prune -f >/dev/null
docker compose ps
