#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f .env ]; then
  cp .env.prod.example .env
  echo "Created .env from .env.prod.example. Fill in real values (POSTGRES_PASSWORD, GEMINI_API_KEY, domains) and re-run."
  exit 1
fi

APP_DOMAIN="$(sed -n 's/^VITE_MAIN_ORIGIN=https:\/\///p' .env)"
SUPPORT_DOMAIN="$(sed -n 's/^VITE_SUPPORT_ORIGIN=https:\/\///p' .env)"
if [ -z "$APP_DOMAIN" ] || [ -z "$SUPPORT_DOMAIN" ]; then
  echo "Set VITE_MAIN_ORIGIN and VITE_SUPPORT_ORIGIN to https://<real-domain> values in .env first."
  exit 1
fi

echo "Installing docker, nginx, certbot..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git >/dev/null
systemctl enable --now docker

echo "Rendering nginx reverse proxy for $APP_DOMAIN and $SUPPORT_DOMAIN..."
sed -e "s/__APP_DOMAIN__/$APP_DOMAIN/g" \
    -e "s/__SUPPORT_DOMAIN__/$SUPPORT_DOMAIN/g" \
    deploy/nginx/demo.conf.template > /etc/nginx/sites-available/demo.conf
ln -sf /etc/nginx/sites-available/demo.conf /etc/nginx/sites-enabled/demo.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Bootstrap complete. DNS must point $APP_DOMAIN and $SUPPORT_DOMAIN to this server."
echo "Then run once for TLS: certbot --nginx -d $APP_DOMAIN -d $SUPPORT_DOMAIN --redirect --non-interactive --agree-tos -m you@example.com"
echo "Then start the stack: docker compose -f docker-compose.prod.yml up -d --build"
