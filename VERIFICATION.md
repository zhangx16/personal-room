# 验证记录

日期：2026-10-23。

已执行并通过：

- `node server/security.test.mjs`：7 项后端测试通过。
- `node server/vault.test.mjs`：1 项浏览器加密模块测试通过（使用 Node WebCrypto）。
- `node --check`：服务入口、校验器与安全辅助模块语法通过。
- TypeScript transpileModule：16 个 TS/TSX 文件的语法检查通过；这不等于完整类型检查。
- `bash -n deploy/install.sh`：部署脚本语法通过。

未完成：

- 完整依赖安装、锁文件生成、完整类型检查与 Vite 构建。
- 浏览器 UI、离线草稿提取、对比度、键盘焦点和各宽度截图验收。
- iPhone Face ID、Windows Hello 实机注册与登录；WebAuthn PRF 实机解锁。
- SimpleWebAuthn 成功签名验证流程的集成测试。
- 域名证书申请、Nginx 配置安装、systemd 启动以及 HTTPS 访问验证。

安装失败原因：联网下载无法解析 npm 域名；尝试离线缓存后缺少 `@dnd-kit/core`。已修正 Tailwind Vite 插件与 Vite 8 的 peer 依赖冲突，改用 PostCSS。
部署限制：当前执行沙箱的可写目录只有 `/root`、`/tmp`，且限制网络与宿主服务访问。尚未向现有 Nginx 站点写入任何配置。
