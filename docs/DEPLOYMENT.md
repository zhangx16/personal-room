# 自托管部署

## Docker：已有反向代理

1. 克隆仓库，复制 `.env.example` 为 `.env`。
2. 设置自己的 `PORTAL_ORIGIN=https://自己的域名`、`PORTAL_SITE_NAME`，可选修改首次管理员名。
3. `docker compose up -d --build`。
4. 为该域名配置 HTTPS，将请求代理到 `127.0.0.1:22836`。如果修改 `.env` 的 `PORT`，代理目标也要对应修改。
5. `docker compose exec web cat /app/data/initial-admin.txt` 查看初始账号，然后登录绑定 TOTP。

应用端口默认仅绑定宿主机 loopback。宿主 Nginx 可使用以下 location（替换域名和证书配置）：

```nginx
location / {
    proxy_pass http://127.0.0.1:22836;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 30s;
    client_max_body_size 128k;
}
```

如果反向代理也在 Docker 内，需让代理加入应用的 Docker 网络，并代理到 `web:22836`；容器内的 `127.0.0.1` 指的是代理容器自己。

## Docker：自动 HTTPS

设置 `.env` 的 `PORTAL_DOMAIN` 与 `PORTAL_ORIGIN` 为同一个域名。域名 A/AAAA 指向服务器，外部 80/443 可达且未被占用，然后：

```bash
docker compose -f compose.yaml -f compose.https.yaml up -d --build
docker compose -f compose.yaml -f compose.https.yaml logs --tail=50 caddy
```

Caddy 负责签发、续期证书和 HTTP 到 HTTPS 重定向。后续管理该方案时也要使用同样的两个 `-f` 参数。不要在已有 Nginx 占用 80/443 的机器上直接启动此方案。

使用 Cloudflare 代理时，生产 TLS 模式选择 Full (strict)，保证 HTTP 证书挑战可以到达源站，并避免对 `/api/*` 设置强制缓存规则。应用本身对 API 返回 `no-store`。

## 原生 systemd + Nginx

适用于已有 Node.js 24+、npm、Nginx、Certbot、Python 3、systemd 的 Debian/Ubuntu 主机。域名需要已解析到服务器，80/443 可达。

```bash
git clone https://github.com/zhangx16/personal-room.git
cd personal-room
sudo env PORTAL_DOMAIN=room.your-domain.com \
  PORTAL_SITE_NAME='我的开发空间' \
  PORTAL_ADMIN_USERNAME=admin \
  bash deploy/install.sh
```

脚本构建应用、创建专用系统用户、生成该域名的 Nginx 配置、申请证书、启用服务，并检查 HTTPS。只应对你计划由该应用管理的域名运行；如果该域名已有配置，脚本会先保存配置备份再替换。

可选安装参数：

| 参数 | 默认值 |
| --- | --- |
| `PORT` | `22836` |
| `PORTAL_INSTALL_DIR` | `/opt/dev-room` |
| `PORTAL_SYSTEM_DATA_DIR` | `/var/lib/dev-room` |
| `PORTAL_SYSTEM_USER` | `devroom` |
| `PORTAL_SERVICE_NAME` | `dev-room` |

目录需为不含空格和 `..` 的绝对路径。在同一机器部署第二份原生实例时，为上面五项选择不同的端口、目录、用户和服务名。

```bash
sudo cat /var/lib/dev-room/initial-admin.txt
sudo systemctl status dev-room
sudo journalctl -u dev-room --tail=50
```

运行配置位于 `/etc/dev-room.env`，服务位于 `/etc/systemd/system/dev-room.service`（如更换服务名则文件名跟随变化）。修改配置后重启相应服务。现有管理员不会因修改初始化用户名而重置。

## 备份、恢复与更新

普通页面导出仅备份普通记录，**不包含保险箱和账号凭据**。完整恢复需要整个数据目录，尤其是 `portal.sqlite` 和 `server.key`。只复制数据库会导致服务端的 TOTP 密钥无法解密。

以下以基础 Compose 为例；若使用自动 HTTPS 方案，命令统一增加 `-f compose.yaml -f compose.https.yaml`。

### 完整备份

先停止应用，避免 SQLite WAL 仍在写入，再从数据卷生成归档。备份文件本身包含敏感数据，应保存在访问受限的位置。

```bash
mkdir -p backups
chmod 700 backups
docker compose stop web
docker compose run --rm --no-deps --user 0 --entrypoint tar \
  -v "$PWD/backups:/backup" web \
  -czf /backup/personal-room-data.tar.gz -C /app/data .
chmod 600 backups/personal-room-data.tar.gz
docker compose start web
```

### 恢复到新的空数据卷

在新部署目录中准备相同配置及备份文件，先构建镜像，尚不要首次启动应用。在空数据卷中解压备份并设置所有者，然后启动：

```bash
docker compose build web
docker compose run --rm --no-deps --user 0 --entrypoint sh \
  -v "$PWD/backups:/backup:ro" web -c \
  'tar -xzf /backup/personal-room-data.tar.gz -C /app/data && chown -R node:node /app/data && chmod 700 /app/data'
docker compose up -d
```

不要把该命令直接用于已有业务数据的卷；恢复目标应是新建的空卷，避免残留 WAL 文件或合并不同实例的数据。保险箱口令仍由你自行保存；完整备份不能代替保险箱口令。

原生部署可在停止相应 systemd 服务后，备份/恢复整个数据目录并保留专用用户的所有权，再启动服务。

### 更新

先完整备份，然后：

```bash
git pull --ff-only
docker compose up -d --build
```

升级不会重新生成已存在的管理员，也不会清空命名卷。不要使用 `docker compose down -v`，除非明确要永久删除该部署的数据卷。

## 常见问题

- **来源无效 / 登录失败**：`PORTAL_ORIGIN` 必须与浏览器地址的协议、域名和端口完全一致，不包含子路径。修改 `.env` 后重建容器配置：`docker compose up -d`。
- **局域网 HTTP 不能使用验证器/加密**：使用自己的 HTTPS 域名，或仅在本机使用 `http://localhost`。不要为了局域网访问关闭 Secure Cookie 或来源验证。
- **初始密码文件不存在**：该管理员可能已经初始化并删除了初始文件；修改 `PORTAL_ADMIN_USERNAME` 不会重置账号。
- **Face ID/Windows Hello 没有出现**：先用密码 + 2FA 登录，在安全设置添加设备；系统会选择可用的设备验证方式。
- **设备快捷解锁不可用**：PRF 扩展并非所有设备都支持，回退保险箱口令即可。
- **端口被占用**：修改 `PORT` 并同步 `PORTAL_ORIGIN`（本地体验）或反向代理目标（公网）；自动 HTTPS 的 80/443 端口需另行解决占用。
