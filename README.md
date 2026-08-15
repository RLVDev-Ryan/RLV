# Ryan's Launcher Vibe (RLV)

一个现代化的 Minecraft 启动器，基于 Electron + React + TypeScript 构建。

## ✨ 特性

- 🚀 **启动** — 管理多个 Minecraft 版本，支持自定义游戏目录
- 📥 **下载** — 从 Mojang 官方源下载游戏版本，支持原版 / Fabric / Forge / NeoForge / Quilt 加载器
- 🌐 **联机** — 基于 EasyTier 的 P2P 虚拟局域网（组网层），配合 Minecraft 局域网协议
- ⚙️ **设置** — 深浅色主题、自定义背景图、自定义字体（思源宋体 / 黑体 / 枫叶等宽）、多语言
- 👤 **账户** — 微软登录 / Yggdrasil 外置登录（Little Skin）
- 🔄 **自动更新** — 基于 electron-updater + GitHub Releases

## 🛠️ 技术栈

- **Electron** 28 + TypeScript + React 18
- **Vite** 5 构建渲染进程
- **electron-builder** 打包
- **@xmcl/user** 认证
- **@azure/msal-node** 微软 OAuth
- **EasyTier** P2P 组网
- **electron-updater** 自动更新

## 🚀 普通用户快速开始

不想折腾代码？点这里下载安装包，双击即可使用！

[![最新版本](https://img.shields.io/github/v/release/RLVDev-Ryan/RLV?label=最新版本&color=success)](https://github.com/RLVDev-Ryan/RLV/releases/latest)

👉 [下载最新安装包（GitHub Releases）](https://github.com/RLVDev-Ryan/RLV/releases/latest)

1. 打开上面的链接，下载 `ryans-launcher-vibe-setup-*.exe`
2. 双击运行，按提示安装即可
3. 启动器内置自动更新，以后有新版本会提示一键升级

> 需要自己编译或参与开发？继续看下面的「开发」章节。

## 🚀 开发

```bash
npm install
npm run dev
```

## 📦 构建

```bash
npm run build      # 编译 TS + Vite
npm run dist:win   # 打包 Windows 安装器
```

## ✅ 代码规范

```bash
npm run lint         # ESLint 检查
npm run check:format # Prettier 格式检查
npm run format       # Prettier 自动格式化
```

CI（GitHub Actions）会在每次 push / PR 时自动运行 ESLint、Prettier 与构建检查，请在提交前确保 `npm run lint` 与 `npm run check:format` 通过。

## 🙏 鸣谢

### 参考的开源启动器项目

| 项目                                                                           | 用途                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| [Hello Minecraft! Launcher (HMCL)](https://github.com/HMCL-dev/HMCL)           | 联机（Terracotta）集成、版本管理、设置界面参考 |
| [PCL2 (Plain Craft Launcher 2)](https://github.com/Hex-Dragon/PCL2)            | UI 风格、加载器图标参考                        |
| [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) | 主进程/渲染进程架构参考                        |
| [RMCL](https://github.com/Asho5kan/RMCL)                                       | 联机与账户逻辑参考                             |
| [YNG Client](https://github.com/yng-nctd/YNG-Client)                           | 微软 OAuth2 登录流程参考                       |

### 核心依赖库

- [Electron](https://www.electronjs.org/) — 跨平台桌面框架
- [React](https://react.dev/) — UI 框架
- [Vite](https://vitejs.dev/) — 构建工具
- [TypeScript](https://www.typescriptlang.org/) — 语言
- [electron-builder](https://www.electron.build/) — 打包
- [electron-updater](https://www.electron.build/auto-update) — 自动更新
- [@xmcl/user](https://github.com/Voxelum/minecraft-launcher-core-node) — 微软 / Yggdrasil 认证
- [@azure/msal-node](https://github.com/AzureAD/microsoft-authentication-library-for-js) — 微软 OAuth
- [lucide-react](https://lucide.dev/) — 图标
- [ESLint](https://eslint.org/) / [Prettier](https://prettier.io/) — 代码规范

### 字体（SIL OFL 1.1）

- [Noto Serif CJK（思源宋体）](https://github.com/notofonts/noto-cjk)
- [Noto Sans CJK（思源黑体）](https://github.com/notofonts/noto-cjk)
- [Noto Sans Mono CJK（思源等宽）](https://github.com/notofonts/noto-cjk)
- [Maple Mono NF CN（枫叶等宽）](https://github.com/subframe7536/maple-font)

### 联机方案

- [EasyTier](https://easytier.cn/) — **P2P 组网层**：随启动器分发 easytier-core，在玩家之间建立虚拟局域网
- [Terracotta](https://github.com/burningtnt/Terracotta) — HMCL 的联机协议（Scaffolding）：仅参考其房间 / 局域网发现逻辑，未捆绑其代码

### 资料与 API

- [Mojang 版本清单 API](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [Minecraft Wiki（wiki.vg 协议）](https://minecraft.wiki/)
- [GitHub](https://github.com/)
- [npmmirror 二进制镜像](https://npmmirror.com/) — electron-builder 构建工具加速

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。

### 字体许可

内置字体均基于 **SIL Open Font License 1.1** 许可，允许自由再分发和嵌入。详见：

- [思源宋体 / 黑体 / 等宽（Noto CJK）](licenses/fonts/notoserif/LICENSE)
- [枫叶等宽（Maple Mono NF CN）](licenses/fonts/maplemono/LICENSE.txt)
- [思源黑体（Noto Sans CJK）](licenses/fonts/notosans/LICENSE)

### 图标

界面图标由 [Lucide](https://lucide.dev) 提供，遵循 **ISC 和 MIT 开源协议**。

## ⚠️ 声明

联机功能涉及两个**不同层面**的第三方开源软件：

- **EasyTier** — 运行时使用的 **P2P 组网层**，作为独立二进制随启动器分发
- **Terracotta** — 仅作 **联机协议 / 设计参考**（HMCL 的 Scaffolding 协议），RLV 未捆绑、未复制其代码

- 请遵守您所在国家与地区的法律法规

## 🚀 发布

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。

发布新版本（构建 + 上传安装包到 GitHub Release，自动更新即可生效）。两种方式任选：

**方式一：推送 tag 触发 CI 自动发布（推荐）**

```bash
git tag v0.4.0
git push origin v0.4.0
```

GitHub Actions 的 `publish` 任务会自动构建 Windows 安装器并发布到 GitHub Release。需在仓库 **Settings → Secrets → Actions** 中配置 `GH_TOKEN`（GitHub Personal Access Token）。

**方式二：本地手动发布**

```bash
npm run dist:publish
```

需在环境变量中设置 `GH_TOKEN`。版本号取自 `package.json` 的 `version`。

发布渠道为正式 Release（`electron-builder.yml` 中 `publish.releaseType: release`，非 draft）。旧版本安装的用户会自动检测到更新。
