# Personal Room · 私人开发工作台

一个可以部署在自己服务器上的开发门户，集中管理项目、Codex 会话、常用网站、运维脚本和加密凭据。每份部署使用自己的域名、账号和数据库，无需连接作者的服务器或账号。

## 能做什么

- **项目库**：保存网站、GitHub、后台地址，关联多个 Codex 会话，复制恢复命令，记录开发进度与下一步。
- **Emby 账号**：粘贴账号消息自动识别线路、用户名、用户密码、安全密码和到期说明；支持多个账号和收藏，登录后直接查看，无需保险箱口令；凭据使用服务端管理的独立派生密钥加密。原始消息只在本机解析，确认后加密保存；普通导出不含 Emby 账号。
- **网站与脚本**：分类、标签、收藏、搜索、代码查看和复制；不会执行脚本。
- **密钥保险箱**：保存 Cloudflare Token、Telegram Bot Token、AI API Key、后台密码等；浏览器加密、按需解锁、自动隐藏。
- **安全登录**：密码 + TOTP 双重验证、一次性恢复码、Passkey；设备可使用 Face ID / Windows Hello。
- **个性化**：站点名称、域名、管理员用户名、端口、数据目录；手机与桌面布局、明暗主题、拖动排序、可调整详情面板。

技术栈：React、shadcn/ui Nova 风格、Lucide、Motion、react-resizable-panels、dnd-kit、Zustand；Node.js 24 + SQLite。

## Docker 部署（推荐）

需要 Docker Engine 与 Docker Compose。准备自己的域名，解析到服务器，并开放 80/443 端口；这些端口需未被其他服务占用。

```bash
git clone https://github.com/zhangx16/personal-room.git
cd personal-room
cp .env.example .env
```

编辑 `.env`，至少修改以下三项：

```dotenv
PORTAL_ORIGIN=https://room.your-domain.com
PORTAL_DOMAIN=room.your-domain.com
PORTAL_SITE_NAME=我的开发空间
```

启动应用和自动 HTTPS 反向代理：

```bash
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

查看首次生成的账号密码：

```bash
docker compose exec web cat /app/data/initial-admin.txt
```

打开自己设置的域名登录。首次登录强制绑定 TOTP 验证器并生成恢复码；请保存恢复码，然后在“安全设置”添加通行密钥。管理员用户名默认 `admin`，可以在首次启动前通过 `PORTAL_ADMIN_USERNAME` 修改。密码由每个实例随机生成，不存在通用默认密码。

服务器已有 Nginx、宝塔或其他反向代理时，仅运行 `docker compose up -d --build`，将自己的 HTTPS 站点反向代理到 `127.0.0.1:22836`，不要启动附带的 Caddy。详细步骤见 [部署文档](docs/DEPLOYMENT.md)。

## 本机体验

在 `.env` 中设置：

```dotenv
PORTAL_ORIGIN=http://localhost:22836
```

```bash
docker compose up -d --build
docker compose exec web cat /app/data/initial-admin.txt
```

使用 `http://localhost:22836`，不要改用局域网 IP；公网部署需要 HTTPS。localhost 的本机体验只供部署者自己访问。

## 配置

| 配置项 | 用途 | 默认值 |
| --- | --- | --- |
| `PORTAL_ORIGIN` | 浏览器实际访问地址，用于来源验证和 Passkey | 原生运行默认 `http://localhost:22836`；Compose 必填 |
| `PORTAL_SITE_NAME` | 登录页、侧栏、页面标题、验证器/Passkey 的名称 | `Dev Room` |
| `PORTAL_ADMIN_USERNAME` | 首次创建的管理员用户名 | `admin` |
| `PORT` | Docker 宿主端口 / 原生 Node 监听端口 | `22836` |
| `HOST` | 原生 Node 监听地址；容器内固定为 `0.0.0.0` | `127.0.0.1` |
| `PORTAL_DATA_DIR` | 原生 Node 数据目录；容器内固定为 `/app/data` | `./data` |
| `PORTAL_DOMAIN` | 仅用于附带 Caddy 自动 HTTPS，只填域名 | 需自行配置 |

Docker 的 SQLite、服务端加密密钥和初始化凭据保存在 `portal_data` 命名卷，重建镜像/容器不会重置账号。不同 Compose 项目名使用不同数据卷；可通过 `docker compose -p 名称` 区分实例。

## 原生 Node 与开发

需要 Node.js 24+：

```bash
npm ci
cp .env.example .env
# 编辑 .env：本机可设 PORTAL_ORIGIN=http://localhost:22836
npm test
npm run build
npm start
```

`npm start` 自动读取 `.env`，首次创建账号，此后保留已有账号和数据；初始凭据位于配置的数据目录。生产环境使用自己的 HTTPS 反向代理。Debian/Ubuntu 的 Nginx + systemd 安装方式见 [部署文档](docs/DEPLOYMENT.md#原生-systemd--nginx)。

开发模式运行 `npm run dev`，另外启动 `npm start`；将 `.env` 的 `PORTAL_ORIGIN` 设为 `http://localhost:5173`。Vite 默认将 API 转发到 22836，如修改后端端口，请同时设置 `VITE_API_PROXY`。

可选浏览器测试：

```bash
npx playwright install chromium
npm run build
npm run test:browser
```

测试使用独立临时数据库与随机端口，不会操作生产数据或替你绑定验证器。

## 安全与数据

- 一个实例是一个管理员的私人空间，不是多租户团队系统。
- Emby 账号登录后可直接查看，服务端管理加密密钥；完整恢复仍需要 `server.key`。其他密钥保险箱口令与登录密码独立；PBKDF2-SHA256 + AES-256-GCM 在浏览器端加密，口令不上传，也不能找回。明文 60 秒或页面进入后台后隐藏。
- Passkey 要求设备用户验证，具体使用人脸、指纹还是 PIN 由系统控制。PRF 设备解锁取决于浏览器/验证器支持，不支持时使用保险箱口令。
- **换域名会影响 Passkey**，旧域名绑定的通行密钥不能直接用于新域名。先确认密码 + 2FA 可用，再在新域名重新绑定。
- 普通 JSON 导出不含密钥记录、账号名和加密密码；完整灾难恢复必须备份整个数据卷，包括数据库和 `server.key`。见 [备份、恢复与更新](docs/DEPLOYMENT.md#备份恢复与更新)。
- 不要提交 `.env`、真实凭据、数据库或数据目录到 GitHub。

Docker Compose 的环境变量使用方式参考 [Docker 官方文档](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)，自动 HTTPS 条件见 [Caddy 官方文档](https://caddyserver.com/docs/automatic-https)。
