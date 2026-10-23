# 开发续接

项目目录：`/root/dev-portal`

正式域名：`https://room.031216.xyz`（尚未部署）

当前会话恢复命令：

```bash
codex resume 01a16833-fcf1-7652-ae83-96c1b4c7d70e
```

先阅读 README.md、REQUIREMENTS.md、design-contract.md、VERIFICATION.md。

用户已授权本项目开发和该域名部署，已说明 Cloudflare DNS 与代理已开启；不需要重复请求部署授权。当前受限环境不能联网安装依赖或配置宿主服务，需要在具备相应运行权限的环境继续。

不要将来源站点注册 ID 当成目标域名部署结果。`.scaffold-archive/` 仅是转向自托管前生成的未发布脚手架；现行应用位于 src/ 与 server/。

剩余顺序：依赖安装及锁文件 → 完整类型检查与构建修复 → UI 与真实 Passkey/PRF 验收 → deploy/install.sh → HTTPS、2FA、Passkey、备份恢复检查。不能在这些步骤完成前宣称上线或安全验收通过。
