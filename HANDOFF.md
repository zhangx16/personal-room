# 开发续接

项目目录：`/root/dev-portal`

正式域名：`https://room.031216.xyz`（已部署）

当前会话恢复命令：

```bash
codex resume 01a16833-fcf1-7652-ae83-96c1b4c7d70e
```

先阅读 README.md、REQUIREMENTS.md、design-contract.md、VERIFICATION.md。

用户已授权本项目开发和该域名部署，已说明 Cloudflare DNS 与代理已开启；不需要重复请求部署授权。2026-10-23 执行权限已恢复，部署已完成。

不要将来源站点注册 ID 当成目标域名部署结果。`.scaffold-archive/` 仅是转向自托管前生成的未发布脚手架；现行应用位于 src/ 与 server/。

已完成：依赖安装和锁文件、完整类型检查、生产构建、8 项后端与加密测试、浏览器临时数据库流程、HTTPS 部署、公网与源站 health 检查、未登录 401。

运行路径 `/opt/dev-room`；数据路径 `/var/lib/dev-room`；服务 `dev-room.service` 已开机启动。初始账号 admin，初始密码文件 `/var/lib/dev-room/initial-admin.txt`，尚未替用户绑定 2FA。

剩余验证限于用户真实 iPhone/Windows 通行密钥、PRF 支持和备份恢复；不得把虚拟验证器测试描述为真机验收。
