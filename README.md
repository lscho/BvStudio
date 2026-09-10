# BFrame Studio

基于 Tauri 2、React 19 和 TypeScript strict 的 AI 视频创作客户端。用同一条时间线同时处理已有视频与纯 AI 生成内容：口播视频走「本地提取音频 → 云端 ASR 时间字幕 → AI 语义选型 → 素材与时间线编排」，无视频走「AI 文案与口播 → 时间字幕 → AI 语义选型 → 素材与时间线编排」，两条链路最终汇入同一个动效匹配入口。

## 快速开始

```bash
npm ci                 # 安装依赖（Node >=22 <23）
npm run dev            # 浏览器预览 http://localhost:1420
npm run typecheck
npm test
npm run desktop:dev    # 桌面开发运行（tauri dev）
```

完整命令、环境变量与 CI 配置见 [`docs/11-本地命令与环境变量.md`](docs/11-本地命令与环境变量.md)。

## 能力概览

- **AI 视频编排**：以时间字幕为唯一文本源的两阶段选型，同一语义段一次生成动效、Shotcraft 镜头、素材绑定、重点词、转场与动作音效，确认后以一次撤销写入。见 [`docs/05-AI生成与动效匹配.md`](docs/05-AI生成与动效匹配.md)。
- **动效体系**：102 个 Overlay Studio 动效 + 6 个素材展示 + 4 个独立背景，统一为 Composition 片段；预览与逐帧导出复用同一组件树。见 [`docs/02-动效体系.md`](docs/02-动效体系.md)。
- **Shotcraft 镜头库**：157 张配方卡、216 个镜头实现，168 个可自动选用、48 个需手动适配，无需 Remotion。见 [`docs/03-Shotcraft镜头.md`](docs/03-Shotcraft镜头.md)。
- **云端语音**：MiMo TTS 配音与 ASR 字幕识别，以实际 WAV 时长回写字幕、动效和视频图层。见 [`docs/07-云端语音.md`](docs/07-云端语音.md)。
- **编辑器与时间线**：视频/动效/字幕/音频统一轨道、场景组、运镜节点、入出点选区、章节与字幕样式。见 [`docs/01-编辑器与时间线.md`](docs/01-编辑器与时间线.md)。
- **媒体与导出**：本地 FFmpeg/FFprobe sidecar，逐帧 RGBA 缓存后由 FFmpeg 合成 H.264/AAC MP4/MOV。见 [`docs/08-媒体管线与导出.md`](docs/08-媒体管线与导出.md)。
- **工程与平台**：`schemaVersion: 32` 兼容 v1–v31；签名应用内更新与 Pro 卡密授权。见 [`docs/09-工程格式与持久化.md`](docs/09-工程格式与持久化.md)、[`docs/10-应用运行时与平台集成.md`](docs/10-应用运行时与平台集成.md)。

## 文档

全部文档索引，以及「改动后应更新哪个文档」的对照表见 [`docs/README.md`](docs/README.md)。

- 开发约束（架构、领域规则、安全边界、验证要求）：[`AGENTS.md`](AGENTS.md)
- 视觉规范（界面结构、样式、主题、图标、动效）：[`DESIGN.md`](DESIGN.md)
- 发布与授权：[桌面更新发布操作手册](docs/16-桌面更新发布操作手册.md) · [更新服务协议](docs/15-桌面更新服务协议.md) · [会员授权协议](docs/17-会员授权服务协议.md) · [卡密运营](docs/18-卡密生成与导入操作手册.md)

## 环境要求

Node `>=22 <23`，使用 npm 与 `package-lock.json`；桌面端需要 Rust 2021 与 Tauri 2 工具链。媒体工具由 `prepare:media-sidecars` 准备，详见 [`docs/08-媒体管线与导出.md`](docs/08-媒体管线与导出.md)。
