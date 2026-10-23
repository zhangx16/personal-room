# 验证记录

2026-10-23 已部署：https://room.031216.xyz 。

已执行并通过：

- npm install：依赖和 package-lock.json 已生成。
- npm run build：完整 TypeScript 类型检查与 Vite 生产构建通过。
- npm test：8 项测试通过，覆盖 TOTP、密码、恢复码、会话、CSRF、记录校验和密文完整性。
- 浏览器独立临时数据库流程：TOTP 首次绑定、恢复码确认、项目/会话保存、密钥加密解锁与重新锁定、Chromium 虚拟通行密钥注册与登录。
- 浏览器页面错误为 0；390px 手机宽度无横向溢出；桌面及手机截图已查看。
- 公网首页 HTTP 200，未登录访问 /api/records 为 401；源站与公网 /api/health 均正常。
- Nginx 配置测试通过，域名专用 HTTPS 证书已签发；证书自动续期已设置。
- dev-room.service active/enabled；数据目录 0700，server.key 与初始凭据文件 0600。

修复：部署脚本 umask 077 导致发布文件不可被专用服务用户读取，已设置代码目录组为 devroom 并仅授予组读取/目录遍历权限；数据目录继续保持 0700。Nginx reload 后的证书切换瞬间导致首次 curl 校验失败，确认重载后源站与公网证书校验均正常，脚本已加入重试。

尚未完成：用户真实 iPhone/Windows 生物验证及 PRF 设备解锁；备份恢复实机演练；独立对比度审核。没有用虚拟测试替代真机结论，也没有替用户绑定生产 TOTP/通行密钥。

截图：/tmp/dev-room-login-desktop.png、/tmp/dev-room-login-mobile.png、/tmp/dev-room-qa/workspace-desktop.png、/tmp/dev-room-qa/workspace-mobile.png。
