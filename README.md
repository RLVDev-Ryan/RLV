A modern Minecraft launcher built with Electron + React + TypeScript.

✨ Features
🚀 Launch — Manage multiple Minecraft versions with support for custom game directories

📥 Download — Download game versions from official Mojang sources, supporting Vanilla / Fabric / Forge / NeoForge / Quilt loaders

🌐 Multiplayer — P2P virtual LAN based on EasyTier, integrated with Minecraft's LAN protocol

⚙️ Settings — Light/Dark themes, custom background images, custom fonts (Source Han Serif / Sans / Maple Mono), and multi-language support

👤 Accounts — Microsoft login / Yggdrasil third-party login (Little Skin)

🔄 Auto-update — Powered by electron-updater + GitHub Releases

🛠️ Tech Stack
Electron 28 + TypeScript + React 18

Vite 5 for renderer process builds

electron-builder for packaging

@xmcl/user for authentication

@azure/msal-node for Microsoft OAuth

EasyTier for P2P networking

electron-updater for auto-updates

🚀 Development
bash
npm install
npm run dev
📦 Build
bash
npm run build      # Compile TS + Vite
npm run dist:win   # Package Windows installer
🙏 Acknowledgements
Open-source Launcher Projects Referenced
Project	Purpose
Hello Minecraft! Launcher (HMCL)	Multiplayer (Terracotta) integration, version management, settings UI reference
PCL2 (Plain Craft Launcher 2)	UI style, loader icon reference
X Minecraft Launcher (XMCL)	Main process / renderer process architecture reference
RMCL	Multiplayer and account logic reference
YNG Client	Microsoft OAuth2 login flow reference
Core Dependencies
Electron — Cross-platform desktop framework

React — UI framework

Vite — Build tool

TypeScript — Language

electron-builder — Packaging

electron-updater — Auto-updates

@xmcl/user — Microsoft / Yggdrasil authentication

@azure/msal-node — Microsoft OAuth

lucide-react — Icons

ESLint / Prettier — Code quality

Fonts (SIL OFL 1.1)
Noto Serif CJK (Source Han Serif)

Noto Sans CJK (Source Han Sans)

Noto Sans Mono CJK (Source Han Mono)

Maple Mono NF CN

Multiplayer Solutions
EasyTier — P2P virtual LAN

Terracotta — HMCL multiplayer protocol reference

References & APIs
Mojang Version Manifest API

Minecraft Wiki (wiki.vg protocol)

GitHub

npmmirror Binary Mirrors — Accelerated downloads for electron-builder build tools

📜 License
This project is open-sourced under the MIT License.

Font Licenses
The bundled fonts are licensed under the SIL Open Font License 1.1, which permits free redistribution and embedding. See:

Source Han Serif / Sans / Mono (Noto CJK)

Maple Mono NF CN

Source Han Sans (Noto Sans CJK)

⚠️ Disclaimer
Terracotta / EasyTier are third-party open-source software

Please comply with the laws and regulations of your country and region
