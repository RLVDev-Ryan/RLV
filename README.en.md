# Ryan's Launcher Vibe (RLV)

[中文](README.md) · [English](README.en.md)

A modern Minecraft launcher built with Electron + React + TypeScript.

## ✨ Features

- 🚀 **Launch** — Manage multiple Minecraft versions, with custom game directories
- 📥 **Download** — Download game versions from Mojang's official sources; supports Vanilla / Fabric / Forge / NeoForge / Quilt loaders
- 🌐 **Multiplayer** — P2P virtual LAN based on EasyTier (networking layer), works with the Minecraft LAN protocol (temporarily hidden from the UI; public node self-hosting in progress)
- ⚙️ **Settings** — Light/dark themes, custom background image, custom fonts (Source Serif / Sans / Maple Mono), multi-language
- 👤 **Accounts** — Microsoft login / Yggdrasil external login (Little Skin)
- 🔄 **Auto-update** — via electron-updater + GitHub Releases

## 🛠️ Tech Stack

- **Electron** 28 + TypeScript + React 18
- **Vite** 5 for the renderer
- **electron-builder** for packaging
- **@xmcl/user** authentication
- **@azure/msal-node** Microsoft OAuth
- **EasyTier** P2P networking
- **electron-updater** auto-update

## 🚀 Quick Start (Regular Users)

Don't want to fiddle with code? Download the installer and double-click to use!

[![Latest release](https://img.shields.io/github/v/release/RLVDev-Ryan/RLV?label=Latest&color=success)](https://github.com/RLVDev-Ryan/RLV/releases/latest)

👉 [Download the latest installer (GitHub Releases)](https://github.com/RLVDev-Ryan/RLV/releases/latest)

1. Open the link above and download `ryans-launcher-vibe-setup-*.exe`
2. Double-click to run and follow the prompts to install
3. The launcher has built-in auto-update — new versions prompt a one-click upgrade

> Want to build it yourself or contribute? Continue to the "Development" section below.

## 🚀 Development

```bash
npm install
npm run dev
```

## 📦 Build

```bash
npm run build      # Compile TS + Vite
npm run dist:win   # Package the Windows installer
```

## ✅ Code Style

```bash
npm run lint         # ESLint
npm run check:format # Prettier check
npm run format       # Prettier auto-format
```

CI (GitHub Actions) runs ESLint, Prettier and the build on every push / PR. Please make sure `npm run lint` and `npm run check:format` pass before committing.

## 🙏 Credits

### Referenced open-source launchers

| Project                                                                        | Usage                                                                         |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [Hello Minecraft! Launcher (HMCL)](https://github.com/HMCL-dev/HMCL)           | Terracotta multiplayer integration, version management, settings UI reference |
| [PCL2 (Plain Craft Launcher 2)](https://github.com/Hex-Dragon/PCL2)            | UI style, loader icons reference                                              |
| [X Minecraft Launcher (XMCL)](https://github.com/Voxelum/x-minecraft-launcher) | Main/renderer process architecture reference                                  |
| [RMCL](https://github.com/Asho5kan/RMCL)                                       | Multiplayer and account logic reference                                       |
| [YNG Client](https://github.com/yng-nctd/YNG-Client)                           | Microsoft OAuth2 login flow reference                                         |

### Core dependencies

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [React](https://react.dev/) — UI framework
- [Vite](https://vitejs.dev/) — build tool
- [TypeScript](https://www.typescriptlang.org/) — language
- [electron-builder](https://www.electron.build/) — packaging
- [electron-updater](https://www.electron.build/auto-update) — auto-update
- [@xmcl/user](https://github.com/Voxelum/minecraft-launcher-core-node) — Microsoft / Yggdrasil auth
- [@azure/msal-node](https://github.com/AzureAD/microsoft-authentication-library-for-js) — Microsoft OAuth
- [lucide-react](https://lucide.dev/) — icons
- [ESLint](https://eslint.org/) / [Prettier](https://prettier.io/) — code style

### Fonts (SIL OFL 1.1)

- [Noto Serif CJK](https://github.com/notofonts/noto-cjk)
- [Noto Sans CJK](https://github.com/notofonts/noto-cjk)
- [Noto Sans Mono CJK](https://github.com/notofonts/noto-cjk)
- [Maple Mono NF CN](https://github.com/subframe7536/maple-font)

### Multiplayer

- [EasyTier](https://easytier.cn/) — **P2P networking layer**: ships easytier-core with the launcher to build virtual LANs between players
- [Terracotta](https://github.com/burningtnt/Terracotta) — HMCL's multiplayer protocol (Scaffolding): only referenced for room / LAN discovery design; its code is not bundled

### Docs & APIs

- [Mojang version manifest API](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [Minecraft Wiki (wiki.vg protocol)](https://minecraft.wiki/)
- [GitHub](https://github.com/)
- [npmmirror binary mirror](https://npmmirror.com/) — accelerates electron-builder build tools

## 📜 License

This project is open-sourced under the [MIT License](LICENSE).

### Font license

Bundled fonts are licensed under the **SIL Open Font License 1.1** — free to redistribute and embed. See:

- [Noto Serif / Sans / Mono CJK](licenses/fonts/notoserif/LICENSE)
- [Maple Mono NF CN](licenses/fonts/maplemono/LICENSE.txt)
- [Noto Sans CJK](licenses/fonts/notosans/LICENSE)

### Icons

UI icons are provided by [Lucide](https://lucide.dev), under the **ISC and MIT** licenses.

## ⚠️ Disclaimer

Multiplayer involves two **distinct** third-party open-source projects:

- **EasyTier** — the **P2P networking layer** used at runtime, distributed as a standalone binary with the launcher
- **Terracotta** — used only as a **protocol / design reference** (HMCL's Scaffolding protocol); RLV does not bundle or copy its code

- Please comply with the laws and regulations of your country / region

## 🚀 Release

Full changelog: [CHANGELOG.md](CHANGELOG.md).

To release a new version (build + upload the installer to GitHub Release; auto-update takes effect). Either way works:

**Option 1: push a tag to trigger CI auto-publish (recommended)**

```bash
git tag v0.4.0
git push origin v0.4.0
```

GitHub Actions' `publish` job auto-builds the Windows installer and publishes a GitHub Release. Requires `GH_TOKEN` (a GitHub Personal Access Token) configured under **Settings → Secrets → Actions**.

**Option 2: publish locally**

```bash
npm run dist:publish
```

Requires `GH_TOKEN` in the environment. The version comes from `package.json`'s `version`.

Releases are public (`electron-builder.yml` sets `publish.releaseType: release`, not draft). Existing installs auto-detect updates.
