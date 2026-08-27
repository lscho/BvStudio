# BVideo Studio

基于 Tauri 2、React 19 和 TypeScript 的 AI 视频创作客户端。使用同一个时间线同时处理已有视频和纯 AI 生成内容。

## 功能

- Tauri 2 + React 19 + TypeScript（strict），Vite 端口 `1420`，`@/` 别名；
- 统一视频时间线：视频、AI 内容、动效、字幕与音频轨道，不区分视频模式和无视频模式；
- 画布支持首个视频自动适配，以及 16:9、9:16、1:1、4:3、自定义分辨率和常用帧率；
- 时间线支持入点/出点选区，AI 内容可在选区起点插入，或精确替换、叠加整个选区；
- 六类内置参数化动效，支持文字、颜色、速度、大小、位置和透明度编辑；
- 独立 `.bveffect` 扩展包支持签名校验、安装、升级和卸载；v2 支持带缓动的位移、缩放、旋转关键帧，预览和 FFmpeg 导出一致；格式与示例见 `docs/effect-package-format.md`；
- 动效注册表独立位于 `src/domain/effects.ts`，云端规划前先在本地用 TF-IDF、中文词组和表达意图向量检索候选动效；
- 桌面端本地视频导入、FFprobe 媒体探测、缩略图和音频波形缓存；
- AI 内容支持顺序插入、替换区间和叠加区间；可让模型从已导入视频中按分镜匹配素材，短素材自动循环，并在属性面板调整素材入点、适配、音量及动效完整参数；
- 视频音轨可由本地 FFmpeg 分离后按原片段时间对齐到独立音效轨，也可另存为 M4A、WAV、MP3 或 FLAC；
- FFmpeg H.264/AAC MP4 导出，支持视频裁剪、变速、音量、画面适配、生成场景、文字动效和字幕合成；
- 工程 JSON 保存和重新打开，持久化本地素材路径；
- 云端模型配置：OpenAI Responses、OpenAI Chat Completions 兼容协议和 Anthropic Messages；支持连接测试、模型列表、请求取消、指数退避重试和会话 Token/费用估算；
- 桌面端 API Key 写入系统钥匙串，模型返回结果通过本地 JSON Schema 校验；
- 本地 Qwen3-ASR 适配器：FFmpeg 提取 16 kHz 单声道音频，Qwen3-ASR 识别，可选 Forced Aligner 时间戳；字/词级结果按标点、停顿、长度和显示时长智能合并，识别任务支持阶段进度与取消，结果映射为可编辑字幕轨并参与导出；
- 设置持久化：桌面运行时走 `@tauri-apps/plugin-store`（`settings.json` / `preferences`），浏览器预览走 `tauri-base:` 命名空间 `localStorage`，损坏数据回退默认值；
- 原生窗口集成：仅 Windows 显示最小化/最大化/关闭按钮，macOS 保留原生红绿灯；标题栏可拖拽（`data-tauri-drag-region`）；debug 构建支持 F12 / Cmd-or-Ctrl+Shift+I 切换 DevTools；
- 签名应用内更新：`@tauri-apps/plugin-updater`，普通更新显示入口，`isForceUpdate` 启动即强制覆盖；
- 发布：`.github/workflows/build-desktop.yml` 构建五个平台（Windows x64/ARM64、macOS Intel/Apple Silicon、Linux x64）的签名安装包与更新包，并把 `desktop-release-manifest.json` 上传到 GitHub Release，供外部更新服务校验导入。

## 本地命令

```bash
npm ci                 # 安装依赖（Node >=22 <23）
npm run dev            # 浏览器预览（http://localhost:1420，无原生窗口/更新请求）
npm run typecheck      # TypeScript 类型检查
npm test               # 前端单元测试（vitest）
npm run test:release   # 发布脚本测试（node --test）
npm run prepare:media-sidecars # 准备安装包内置的 FFmpeg/FFprobe
npm run build          # 前端生产构建（默认 VITE_ENABLE_UPDATER 关闭）
npm run desktop:dev    # 桌面开发运行（tauri dev）
npm run desktop:build  # 桌面 release 构建（未配置签名/更新端点）
npm run generate:icons # 从 src-tauri/app-icon.svg 重新生成图标集
```

## 本地媒体与字幕环境

`npm ci` 安装对应平台的 `ffmpeg-static` 与 `@ffprobe-installer/ffprobe`；Tauri 开发和发布构建会自动执行 `prepare:media-sidecars`，把经过 `-version` 校验的工具复制到 `src-tauri/binaries` 并随应用分发。客户端按 `BVIDEO_FFMPEG_PATH` / `BVIDEO_FFPROBE_PATH`、应用资源目录、Homebrew 常见目录和 `PATH` 的顺序查找。Windows ARM64 安装包内置 x64 媒体工具，由 Windows ARM 的 x64 仿真层运行。

Qwen3-ASR 使用独立 Python 环境，模型和音频都保留在本机：

```bash
python3 -m venv .venv-asr
.venv-asr/bin/pip install -U 'qwen-asr>=0.0.6,<0.1' torch
```

在客户端设置中填写该环境的 Python 路径、本地 `Qwen3-ASR-0.6B` 模型目录；需要精确字幕时间戳时再填写本地 `Qwen3-ForcedAligner-0.6B` 目录。Apple Silicon 可选择 `MPS`，NVIDIA 设备选择 `CUDA`，也可以使用 CPU（速度明显更慢）。

构建带签名与更新端点的本地发布包：

```bash
export RELEASE_VERSION=0.1.0 VITE_ENABLE_UPDATER=true
export TAURI_SIGNING_PUBLIC_KEY='<公钥>'
export TAURI_SIGNING_PRIVATE_KEY='<私钥>'
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<可选密码>'
export TAURI_UPDATER_ENDPOINT='https://updates.example.com/api/desktop-updates/latest?platform={{target}}'
export RUNNER_TEMP="$(mktemp -d)"
npm run release:config
npm run tauri -- build --config "$RUNNER_TEMP/tauri-base-release/tauri.release.conf.json"
```

`release:config` 只把版本与更新器设置写入 `$RUNNER_TEMP/tauri-base-release/tauri.release.conf.json` 临时覆盖文件，**不会**修改提交的 `src-tauri/tauri.conf.json`。

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_ENABLE_UPDATER` | `.env`（示例见 `.env.example` / `.env.production.example`） | `"true"` 才允许客户端发起更新检查；浏览器预览与默认构建保持关闭 |
| `TAURI_UPDATER_ENDPOINT` | GitHub 仓库变量 | 含 `{{target}}` 占位符的公共 HTTPS 端点模板；只进入发布构建配置，不进入前端代码 |

## GitHub 变量 / Secrets

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `TAURI_UPDATER_ENDPOINT` | Variable | 更新端点模板（见上） |
| `TAURI_SIGNING_PUBLIC_KEY` | Variable 或 Secret | 客户端内置的更新公钥 |
| `TAURI_SIGNING_PRIVATE_KEY` | Secret | 签名更新包的私钥 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Secret（可选） | 私钥密码 |
| `APPLE_CERTIFICATE` | Secret | Base64 编码的 Developer ID P12 |
| `APPLE_CERTIFICATE_PASSWORD` | Secret | P12 密码 |
| `APPLE_SIGNING_IDENTITY` | Variable | 签名证书身份名称 |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` | Variable | App Store Connect API Issuer ID / Key ID |
| `APPLE_API_KEY_P8` | Secret | Base64 编码的 `.p8` 私钥 |

## 发布

1. 推送 `vX.Y.Z` 标签（严格 SemVer）或手动触发 `build-desktop` 工作流并填 `version`（手动触发只保留产物与清单，不创建 Release、不联系外部 API）；
2. 五个矩阵任务构建并签名平台产物，`prepare-release` 汇总生成 `desktop-release-manifest.json`；
3. 标签推送时 `release` 任务创建/更新对应的 GitHub Release，上传全部资产；
4. 外部更新服务按 `docs/updater-api.md` 校验并导入清单后发布更新记录。

生成的安装包 / 更新包对：

| 平台 | 安装包 | 更新包 |
| --- | --- | --- |
| `windows-x86` | `tauri-base_{version}_x64-setup.exe`（NSIS，签名） | 同一个 `.exe`（NSIS 被动安装） |
| `windows-arm` | `tauri-base_{version}_arm64-setup.exe`（NSIS，签名） | 同一个 `.exe` |
| `macos-x86` | `tauri-base_{version}_x64.dmg` | `tauri-base_{version}_aarch64_x64.app.tar.gz` + `.sig` |
| `macos-arm` | `tauri-base_{version}_arm64.dmg` | `tauri-base_{version}_aarch64_arm64.app.tar.gz` + `.sig` |
| `linux-x86` | `tauri-base_{version}_amd64.AppImage`（同时发布 `.deb`） | `tauri-base_{version}_amd64.AppImage.tar.gz` + `.sig` |

内部构建产物暂时继续沿用脚手架的 `tauri-base` 文件名前缀，以保持现有签名更新脚本兼容；应用显示名和 bundle identifier 已切换为 BVideo Studio。

## 更新服务协议

客户端与外部更新服务的精确契约见 [`docs/updater-api.md`](docs/updater-api.md)：`GET /api/desktop-updates/latest?platform={{target}}`，`204` 是无更新的正常结果。本仓库不实现该服务。
