# Dev Room · 私人开发空间

源码仓库：https://github.com/zhangx16/personal-room

目标地址：`https://room.031216.xyz`。已部署上线，HTTPS 与未登录访问拦截已验证；完整构建和浏览器流程检查通过。

## 功能

项目库、多个 Codex 会话、恢复命令复制、进度与下一步；网站导航、运维脚本；密钥保险箱可保存 Cloudflare、Telegram、AI API 等凭据。支持标签、收藏、全文搜索、拖动排序、右侧可调整详情面板、手机布局、深浅主题与普通记录导入导出。

UI 使用 shadcn Radix 组件按 Nova token 与密度调整，图标为 Lucide，动画使用 Motion，面板为 react-resizable-panels，拖拽使用 dnd-kit，状态由 Zustand 管理。

## 登录与密钥

- 首次管理员凭据由 `npm run init` 随机生成，写入数据目录 `initial-admin.txt`（0600），不写入源码。
- 首次登录强制绑定 TOTP，显示一次性恢复码；常规登录需要密码及 TOTP/恢复码。
- 可在安全设置添加通行密钥；注册需再次提供密码及未使用的 TOTP/恢复码。验证强制 `userVerification: required`，实际生物验证或 PIN 由系统控制。
- Passkey 注册与登录已通过 Chromium 虚拟验证器测试；Face ID / Windows Hello 仍需在你的真实设备上完成绑定和确认。PRF 能力并非所有验证器都具备；不支持时使用保险箱口令。
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

## 运行与验收状态

2026-10-23 已部署：https://room.031216.xyz 。Cloudflare 代理保留，域名专用证书已签发并设置自动续期。服务 `dev-room.service` 已启用开机启动。

- 源码：`/root/dev-portal`；运行目录：`/opt/dev-room`；数据：`/var/lib/dev-room`。
- 初始账号：`admin`；随机初始密码位于 `/var/lib/dev-room/initial-admin.txt`（0600）。首次登录强制绑定 TOTP，再保存恢复码；建议随后修改初始密码并删除该文件。
- 完整类型检查、生产构建、8 项后端/加密测试通过。
- 独立临时数据库上的浏览器流程通过：TOTP 绑定、项目与会话保存、密钥加密/解锁/锁定、虚拟通行密钥注册与登录；390px 手机宽度无横向溢出；无页面运行错误。
- 真实 iPhone/Windows 生物验证、PRF 能力及离线备份恢复的实机验收仍需另行完成；当前未替用户绑定任何真实验证器或设备。

查看服务：`systemctl status dev-room`；日志：`journalctl -u dev-room`。续接信息见 HANDOFF.md，详细测试见 VERIFICATION.md。
