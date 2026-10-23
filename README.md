# Dev Room · 私人开发空间

目标地址：`https://room.031216.xyz`。当前源码与部署文件已准备，尚未构建、部署或完成浏览器验收。

## 功能

项目库、多个 Codex 会话、恢复命令复制、进度与下一步；网站导航、运维脚本；密钥保险箱可保存 Cloudflare、Telegram、AI API 等凭据。支持标签、收藏、全文搜索、拖动排序、右侧可调整详情面板、手机布局、深浅主题与普通记录导入导出。

UI 使用 shadcn Radix 组件按 Nova token 与密度调整，图标为 Lucide，动画使用 Motion，面板为 react-resizable-panels，拖拽使用 dnd-kit，状态由 Zustand 管理。

## 登录与密钥

- 首次管理员凭据由 `npm run init` 随机生成，写入数据目录 `initial-admin.txt`（0600），不写入源码。
- 首次登录强制绑定 TOTP，显示一次性恢复码；常规登录需要密码及 TOTP/恢复码。
- 可在安全设置添加通行密钥；注册需再次提供密码及未使用的 TOTP/恢复码。验证强制 `userVerification: required`，实际生物验证或 PIN 由系统控制。
- Face ID / Windows Hello 的真实设备验收尚未执行。PRF 能力并非所有验证器都具备；不支持时使用保险箱口令。
- 密钥使用浏览器 PBKDF2-SHA256（600000 次）与 AES-256-GCM 加密。保险箱口令不上传，无法重置或找回。
- 设备快捷解锁通过 PRF 输出包装口令，包装结果保存在当前浏览器。PRF 输出不上传。更换浏览器、移除通行密钥或清除站点存储后需重新配置。
- 服务器 TOTP 密钥使用数据目录 `server.key` 加密。完整服务器恢复需要同时备份数据库和该文件。
- 普通导出不包含密钥记录、账号名或加密密码。普通导入使用新编号追加；中断时可能已导入一部分，通知会显示未完成。
- SQLite 版本校验防止旧窗口覆盖新数据；变更冲突时请刷新再编辑。

## 安装与运行

需要 Node.js 24+、npm；生产环境使用 Nginx、Certbot 与 systemd。

```bash
cd /root/dev-portal
npm install
npm test
npm run build
npm run init
PORTAL_ORIGIN=https://room.031216.xyz npm start
```

生产安装脚本：`bash /root/dev-portal/deploy/install.sh`。它会安装构建依赖、运行检查、创建 `devroom` 专用用户，将应用部署到 `/opt/dev-room`，数据放到 `/var/lib/dev-room`，设置 systemd 与此域名的独立 Nginx 配置，并申请域名专用证书。已有其他站点不属于此脚本的修改范围。

Cloudflare 保持代理开启，SSL/TLS 模式使用 Full (strict)。若有“Cache Everything”规则，需要排除该域名的 `/api/*`；应用自身返回 no-store。

本地前端调试 `npm run dev`，API 另用 `PORTAL_ORIGIN=http://localhost:5173 npm start`；必须通过 HTTPS 或 localhost 使用 WebAuthn。生产域名的通行密钥不能移到另一个域名使用。

## 现有环境限制

本轮执行环境网络被限制，npm 域名无法解析，离线缓存也缺少 dnd-kit 等包；依赖未安装完成。完整类型检查、Vite 构建、页面截图、iPhone/Windows 真机验证均未完成。当前沙箱仅可写 `/root` 与 `/tmp`，不能安装 `/etc/nginx`、`/etc/systemd` 配置，也不能管理宿主服务，因此不能声称已经上线。

后端测试可直接运行 `node server/security.test.mjs` 和 `node server/vault.test.mjs`，不依赖外部包；Passkey 的成功注册与签名验证需要安装 SimpleWebAuthn 后另行验收。

下一次 Codex 可直接从本目录、`REQUIREMENTS.md` 与 `design-contract.md` 继续，先恢复依赖安装及完整构建，再在有宿主系统权限的执行环境运行部署脚本并完成 HTTPS、2FA、Passkey 和移动端验收。
