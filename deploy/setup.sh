#!/usr/bin/env bash
# One-time VPS setup (Ubuntu 22.04/24.04). Run as root from the cloned repo:
#   sudo bash deploy/setup.sh <domain> <email>
# DNS first: A records for <domain> and s3.<domain> -> VPS IP.
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain> <email>}"
EMAIL="${2:?usage: setup.sh <domain> <email>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)."; exit 1; }

echo "==> Packages"
apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw
docker compose version >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh

echo "==> Firewall (only SSH + HTTP/HTTPS are public)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Secrets are generated once; re-running keeps the existing .env
if [[ ! -f "$ROOT/.env" ]]; then
  cat > "$ROOT/.env" <<ENV
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 16)
MINIO_ROOT_USER=filecloud
MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENV
  chmod 600 "$ROOT/.env"
fi

echo "==> Nginx + HTTPS"
sed "s/__DOMAIN__/$DOMAIN/g" "$ROOT/deploy/nginx.conf" > /etc/nginx/sites-available/filecloud
ln -sf /etc/nginx/sites-available/filecloud /etc/nginx/sites-enabled/filecloud
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" -d "$DOMAIN" -d "s3.$DOMAIN"

echo "==> Build + start containers"
bash "$ROOT/deploy/deploy.sh"

echo
echo "FileCloud is live at https://$DOMAIN"
echo "Secrets: $ROOT/.env"
