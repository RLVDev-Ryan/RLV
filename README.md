# Ryan's Launcher Vibe (RLV)

一个现代化的 Minecraft 启动器，基于 Electron + React + TypeScript 构建。

## ✨ 特性

- 🚀 **启动** — 管理多个 Minecraft 版本，支持自定义游戏目录
- 📥 **下载** — 从 Mojang 官方源下载游戏版本，支持原版 / Fabric / Forge / NeoForge / Quilt 加载器
- 🌐 **联机** — 基于 EasyTier 的 P2P 虚拟局域网，配合 Minecraft 局域网协议
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

## 🙏 鸣谢

### 参考的开源启动器项目

| 项目 | 用途 |
|------|------|
| [Hello Minecraft! Launcher (HMCL)](https://github.com/HMCL-dev/HMCL) | 联机（Terracotta）集成、版本管理、设置界面参考 |
| [PCL2 (Plain Craft Launcher 2)](https://github.com/Hex-Dragon/PCL2) | UI 风格、加载器图标参考 |
| [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) | 主进程/渲染进程架构参考 |
| [RMCL](https://github.com/Asho5kan/RMCL) | 联机与账户逻辑参考 |
| [YNG Client](https://github.com/yng-nctd/YNG-Client) | 微软 OAuth2 登录流程参考 |

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

- [EasyTier](https://easytier.cn/) — P2P 虚拟局域网
- [Terracotta（陶瓦联机）](https://github.com/burningtnt/Terracotta) — HMCL 联机协议参考

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

## ⚠️ 声明

- 陶瓦联机（Terracotta / EasyTier）为第三方开源软件
- 请遵守您所在国家与地区的法律法规
