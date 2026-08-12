# 更新日志

本项目版本号采用语义化版本（SemVer），遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

## [4.0.0] - 2026-08-12

### 🎉 新增

- **联机系统**：基于 EasyTier 的 P2P 虚拟局域网 + Terracotta / Scaffolding 协议的房间联机
  - 创建房间（校验局域网游戏端口）与邀请码加入
  - 真实局域网组播发现（`Open to LAN` 端口自动检测）
  - 玩家列表、连接质量（NAT 类型）展示
- **整合包导出**：支持导出 Mod / 资源包 / 光影 / 存档 / 截图 / 选项文件，可**按具体 Mod 勾选导出**
- **Modrinth 模组搜索与下载**：按游戏版本与加载器筛选
- **日志页面**：实时查看 / 清空 / 打开日志文件夹
- **背景音乐播放器**：本地音乐目录播放、音量控制
- **可移植数据目录** + 用户可编辑 `.js` 配置系统（`.RLV/` 便携模式）
- **按需字体下载**：思源黑体 / 枫叶等宽等字体按需拉取
- **下载镜像（BMCLAPI）**：国内用户加速下载
- **版本筛选**：可编辑输入 + 默认显示全部版本
- **关于界面**：开源致谢 + **各项目许可证跳转链接**

### 🐛 修复

- 版本详情「设置」页打开白屏（`jvmArgs`/`gameArgs` 配置数据规范化）
- 联机「创建房间」卡片 hover 只有上半部分发光
- 渲染进程 `process.env` 访问崩溃防护（`config.ts` / `fonts.ts`）

### 🏗️ 工程

- **CI（GitHub Actions）**：每次 push / PR 自动运行 ESLint、Prettier、构建检查；推送 `v*` tag 自动构建并发布 Windows 安装器
- **electron-builder**：发布配置补全（`releaseType: release`、`publisherName`）
- **electron-updater**：错误处理健壮化，更新检查失败不再影响主界面加载
- 全仓库 Prettier 统一格式化
