#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/opt/demo
GIT_SHA="${1:-}"

cd "$REPO_DIR"
if [ -n "$GIT_SHA" ] && [ -d .git ]; then
  git fetch origin --quiet || true
  git checkout -f --quiet "$GIT_SHA"
fi

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f
docker compose -f docker-compose.prod.yml ps
