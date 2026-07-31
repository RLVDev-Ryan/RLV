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

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。

## ⚠️ 声明

- 陶瓦联机（Terracotta / EasyTier）为第三方开源软件
- 请遵守您所在国家与地区的法律法规
