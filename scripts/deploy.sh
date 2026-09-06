#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/opt/demo
GIT_SHA="${1:?usage: deploy.sh <commit-sha>}"

cd "$REPO_DIR"
git fetch origin --quiet
git checkout -f --quiet "$GIT_SHA"

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f
docker compose -f docker-compose.prod.yml ps
