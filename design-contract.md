# Dev Room 界面约定

主设计来源由用户指定：shadcn/ui Nova；Lucide、Motion、react-resizable-panels、dnd-kit、Zustand。
目标域名：https://room.031216.xyz 。用户指定服务器部署，因此最终应用使用 React/Vite + Node.js/SQLite，不依赖 Sites 登录与存储。

## 设计语言

- Nova neutral 语义色：背景、文本、边框、主操作统一使用变量。
- 白色/深色工作区域、低对比侧栏、细分割线，单一黑白主按钮。
- 页面 14px 基础字体；操作按钮默认 32px，移动端表单与关键操作增大。
- 按钮和输入框的尺寸依据官方 style-nova 源码调整；采用现有 Radix shadcn 组件基础，未声称已成功安装完整 Nova registry。
- 默认中文系统字体，Latin 部分优先使用系统 Inter；字体不依赖远程请求。
- 侧栏分类、统一搜索、中间列表、右侧详情；手机详情独占内容区域。
- 桌面详情宽度由 react-resizable-panels 调整；列表排序由 dnd-kit 手柄触发，含键盘传感器。
- 图标一律来自 Lucide。页面与提示的进入动画由 Motion 实现，尊重减少动态效果设置。
- Zustand 保存界面状态，浏览器仅持久化主题偏好；业务记录在 SQLite。

## 界面与状态

登录、首次 TOTP 绑定、恢复码确认、密码/2FA 登录、Passkey 登录；主界面包括加载、错误、空记录、空搜索结果、分类、标签、编辑、删除确认、安全设置、密钥锁定与查看。
UI 条件状态在 React 源码实现；未添加虚构项目、密钥或服务器状态。

锚点：auth/login、workspace/sidebar、workspace/topbar、workspace/collection、workspace/quick-add、records/item#UUID、detail、detail/vault。

## 安全与设备行为

- 普通备份不含密钥记录、加密密码或账号名。完整备份需要服务器数据库及 server.key。
- 保险箱口令不上传；浏览器 PBKDF2 + AES-GCM；明文只在组件内存中存在，60 秒或页面进入后台后清除。
- PRF 输出不发送给服务端；仅在本机包装保险箱口令。PRF 不可用时明确提示使用口令。
- Passkey 的 RP ID 固定于配置域名，绑定要求密码与新 2FA 码，断言要求用户验证。

## 验证状态

依赖下载受环境网络限制。当前尚不能进行完整构建、浏览器截图、375/768/1440 宽度实测或对比度实测；这些检查不能视为通过。
静态草稿应从成功运行的应用提取，不能用另一个手写页面冒充参考实现。待依赖可安装后，生成离线草稿、绑定 review panel 并进行实际宽度审核。

参考：https://ui.shadcn.com/create 、https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/styles/style-nova.css
