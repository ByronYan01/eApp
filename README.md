# eApp 英语句子学习客户端 🚀

一款基于 **Tauri (v2)** + **Vue 3** + **TypeScript** 开发的现代化桌面端英语句子学习软件。

## ✨ 功能特性

* **句子学习**：支持输入英语句子，智能解析单词、句子的翻译与音标。
* **原声/TTS发音**：集成高可靠的发音播放功能，支持在线真人原声/TTS发音播放。
* **复习列表**：便捷地将句子加入到学习列表中，随时回顾复习。
* **精致交互**：极致流畅的桌面端体验，支持自由调整窗口尺寸、全屏和无边框拖拽移动。

---

## 🛠️ 本地开发调试

在开始前，请确保您的设备已配置好 Node.js 和 Rust 编译环境。

1. **安装前端依赖**：
   ```bash
   npm install
   ```

2. **启动本地开发预览**：
   ```bash
   npm run tauri dev
   ```

---

## 📦 客户端打包与分发

### 1. 本地打包（基于当前操作系统）
打包生成的安装包将自动带有高度优化的二进制文件，无需用户安装 Rust 环境即可双击运行。
```bash
npm run tauri build
```
* **macOS**：打包生成 `.dmg` 安装包，位于 `src-tauri/target/release/bundle/dmg/`
* **Windows**：打包生成 `.msi` 或 `.exe` 安装包，位于 `src-tauri/target/release/bundle/msi/` 或 `nsis/`

---

## ☁️ GitHub Actions 自动化云端打包发布（推荐）

本项目已集成 **GitHub Actions** 自动化打包工作流。每当您推送一个以 `v` 开头的标签（如 `v0.1.0`）到 GitHub，云端服务器便会自动在 macOS (Universal 通用包) 和 Windows 平台上完成打包，并将安装文件直接挂载到您的 GitHub **Releases** 页面中。

### 触发自动发布流程：
1. **给项目推送版本 Tag**：
   ```bash
   git add .
   git commit -m "docs: 完善项目说明文档并启用自动打包工作流"
   git push origin main
   
   # 创建版本标签并推送到远端
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. **下载安装包**：
   推送成功后，请稍等 5-10 分钟，前往您 GitHub 仓库的 **Releases** 页面即可下载最新的安装包。
