#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $(id -u) != 0 ]]; then echo '需要以 root 执行部署脚本。' >&2; exit 1; fi
portal_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$portal_root"
command -v node >/dev/null
command -v nginx >/dev/null
command -v certbot >/dev/null
if (( $(node -p 'Number(process.versions.node.split(".")[0])') < 24 )); then echo '需要 Node.js 24 或以上版本。' >&2; exit 1; fi
if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
npm test
npm run build
if ! id devroom >/dev/null 2>&1; then useradd --system --home-dir /var/lib/dev-room --shell /usr/sbin/nologin devroom; fi
install -d -m 755 /opt/dev-room /opt/dev-room/server
install -d -m 700 -o devroom -g devroom /var/lib/dev-room
cp -a dist /opt/dev-room/
cp -a server/*.mjs /opt/dev-room/server/
cp package.json package-lock.json /opt/dev-room/
cd /opt/dev-room
npm ci --omit=dev --no-audit --no-fund
chgrp -R devroom /opt/dev-room
chmod -R g+rX /opt/dev-room
if [[ ! -f /var/lib/dev-room/portal.sqlite ]]; then
    runuser -u devroom -- env PORTAL_DATA_DIR=/var/lib/dev-room /usr/bin/node server/init.mjs
fi
install -m 644 "$portal_root/deploy/dev-room.service" /etc/systemd/system/dev-room.service
systemctl daemon-reload
systemctl enable --now dev-room.service
systemctl restart dev-room.service
if [[ ! -f /etc/letsencrypt/live/room.031216.xyz/fullchain.pem ]]; then
    if [[ -e /etc/nginx/sites-enabled/room.031216.xyz ]]; then
        echo '已有同域名 Nginx 配置，需要先检查，未覆盖该配置。' >&2; exit 1
    fi
    install -m 644 "$portal_root/deploy/room.031216.xyz.http.conf" /etc/nginx/sites-available/room.031216.xyz
    ln -s /etc/nginx/sites-available/room.031216.xyz /etc/nginx/sites-enabled/room.031216.xyz
    nginx -t
    systemctl reload nginx
    certbot certonly --webroot -w /var/www/html -d room.031216.xyz --non-interactive --agree-tos --register-unsafely-without-email --deploy-hook 'systemctl reload nginx'
fi
if [[ -f /etc/nginx/sites-available/room.031216.xyz ]]; then
    cp -a /etc/nginx/sites-available/room.031216.xyz "/etc/nginx/sites-available/room.031216.xyz.backup.$(date +%s)"
fi
install -m 644 "$portal_root/deploy/room.031216.xyz.conf" /etc/nginx/sites-available/room.031216.xyz
if [[ ! -e /etc/nginx/sites-enabled/room.031216.xyz ]]; then ln -s /etc/nginx/sites-available/room.031216.xyz /etc/nginx/sites-enabled/room.031216.xyz; fi
nginx -t
systemctl reload nginx
curl --fail --silent --show-error http://127.0.0.1:22836/api/health
curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 1 --resolve room.031216.xyz:443:127.0.0.1 https://room.031216.xyz/api/health
printf '\n部署完成：https://room.031216.xyz\n初始凭据（仅首次初始化）：/var/lib/dev-room/initial-admin.txt\n'
