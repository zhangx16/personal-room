#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $(id -u) != 0 ]]; then echo '需要 root；用法：sudo PORTAL_DOMAIN=room.example.com bash deploy/install.sh' >&2; exit 1; fi
portal_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
portal_domain=${PORTAL_DOMAIN:-${1:-}}
portal_port=${PORT:-22836}
portal_install=${PORTAL_INSTALL_DIR:-/opt/dev-room}
portal_data=${PORTAL_SYSTEM_DATA_DIR:-/var/lib/dev-room}
portal_user=${PORTAL_SYSTEM_USER:-devroom}
portal_service=${PORTAL_SERVICE_NAME:-dev-room}
if [[ ! $portal_domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ || $portal_domain != *.* ]]; then echo '请提供有效的 PORTAL_DOMAIN（只填域名）。' >&2; exit 1; fi
for value in "$portal_install" "$portal_data"; do
    if [[ ! $value =~ ^/[a-zA-Z0-9_./-]+$ || $value == / || /$value/ == */../* ]]; then echo '安装/数据目录必须是无空格的绝对路径，不能包含 ..。' >&2; exit 1; fi
done
if [[ ! $portal_user =~ ^[a-z][a-z0-9_-]{0,30}$ || ! $portal_service =~ ^[a-z][a-z0-9_-]{0,30}$ ]]; then echo '服务名或系统用户名无效。' >&2; exit 1; fi
for tool in node npm nginx certbot python3 curl runuser; do command -v "$tool" >/dev/null; done
portal_node=$(command -v node)
if (( $(node -p 'Number(process.versions.node.split(".")[0])') < 24 )); then echo '需要 Node.js 24+。' >&2; exit 1; fi
export PORTAL_ORIGIN="https://$portal_domain" PORTAL_DATA_DIR="$portal_data" PORT="$portal_port" HOST=127.0.0.1
cd "$portal_root"
node --input-type=module -e 'import {runtimeConfig} from "./server/config.mjs";runtimeConfig();'
npm ci --no-audit --no-fund
npm test
npm run build
if ! id "$portal_user" >/dev/null 2>&1; then useradd --system --home-dir "$portal_data" --shell /usr/sbin/nologin "$portal_user"; fi
install -d -m 755 "$portal_install" "$portal_install/server"
install -d -m 700 -o "$portal_user" -g "$portal_user" "$portal_data"
cp -a dist "$portal_install/"
cp -a server/*.mjs "$portal_install/server/"
cp package.json package-lock.json "$portal_install/"
cd "$portal_install"
npm ci --omit=dev --no-audit --no-fund
chgrp -R "$portal_user" "$portal_install"
chmod -R g+rX "$portal_install"
# Idempotent startup creates an account only if the database has none.
runuser -u "$portal_user" -- env PORTAL_ORIGIN="$PORTAL_ORIGIN" PORTAL_DATA_DIR="$portal_data" PORTAL_ADMIN_USERNAME="${PORTAL_ADMIN_USERNAME:-admin}" "$portal_node" server/init.mjs
export PORTAL_RENDER_ROOT="$portal_root" PORTAL_RENDER_INSTALL="$portal_install" PORTAL_RENDER_DATA="$portal_data" PORTAL_RENDER_USER="$portal_user" PORTAL_RENDER_SERVICE="$portal_service" PORTAL_RENDER_NODE="$portal_node" PORTAL_RENDER_DOMAIN="$portal_domain"
python3 - <<'PY'
from pathlib import Path
import os,json,time
root=Path(os.environ['PORTAL_RENDER_ROOT'])/'deploy'
values={k:os.environ['PORTAL_RENDER_'+k] for k in ['INSTALL','DATA','USER','SERVICE','NODE','DOMAIN']}
replace={'INSTALL_DIR':values['INSTALL'],'DATA_DIR':values['DATA'],'USER':values['USER'],'SERVICE':values['SERVICE'],'NODE':values['NODE'],'DOMAIN':values['DOMAIN'],'PORT':os.environ['PORT']}
def render(name):
 s=(root/name).read_text()
 for k,v in replace.items():s=s.replace('__'+k+'__',v)
 return s
Path('/etc/systemd/system/'+values['SERVICE']+'.service').write_text(render('systemd.service.template'))
env={k:os.environ[k] for k in ['PORTAL_ORIGIN','PORT','HOST']}
env.update(PORTAL_DATA_DIR=values['DATA'],PORTAL_SITE_NAME=os.environ.get('PORTAL_SITE_NAME','Dev Room'))
p=Path('/etc/'+values['SERVICE']+'.env');p.write_text(''.join(k+'='+json.dumps(v,ensure_ascii=False)+'\n' for k,v in env.items()));p.chmod(0o600)
nginx=Path('/etc/nginx/sites-available')/values['DOMAIN']
if nginx.exists():nginx.with_name(nginx.name+'.backup.'+str(int(time.time()))).write_bytes(nginx.read_bytes())
cert=Path('/etc/letsencrypt/live')/values['DOMAIN']/'fullchain.pem'
nginx.write_text(render('nginx.conf.template' if cert.exists() else 'nginx-http.conf.template'));nginx.chmod(0o644)
link=Path('/etc/nginx/sites-enabled')/values['DOMAIN']
if not link.exists():link.symlink_to(nginx)
PY
chmod 644 "/etc/systemd/system/$portal_service.service"
systemctl daemon-reload
systemctl enable "$portal_service.service"
systemctl restart "$portal_service.service"
nginx -t
systemctl reload nginx
if [[ ! -f /etc/letsencrypt/live/$portal_domain/fullchain.pem ]]; then
    certbot certonly --webroot -w /var/www/html -d "$portal_domain" --non-interactive --agree-tos --register-unsafely-without-email --deploy-hook 'systemctl reload nginx'
    python3 - <<'PY'
from pathlib import Path
import os
s=(Path(os.environ['PORTAL_RENDER_ROOT'])/'deploy/nginx.conf.template').read_text().replace('__DOMAIN__',os.environ['PORTAL_RENDER_DOMAIN']).replace('__PORT__',os.environ['PORT'])
Path('/etc/nginx/sites-available',os.environ['PORTAL_RENDER_DOMAIN']).write_text(s)
PY
    nginx -t
    systemctl reload nginx
fi
curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 1 "http://127.0.0.1:$portal_port/api/health"
curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 1 --resolve "$portal_domain:443:127.0.0.1" "$PORTAL_ORIGIN/api/health"
printf '\n部署完成：%s\n初始凭据：%s/initial-admin.txt\n' "$PORTAL_ORIGIN" "$portal_data"
