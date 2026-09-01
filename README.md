# BVideo Studio

基于 Tauri 2、React 19 和 TypeScript 的 AI 视频创作客户端。使用同一个时间线同时处理已有视频和纯 AI 生成内容。

## 功能

- Tauri 2 + React 19 + TypeScript（strict），Vite 端口 `1420`，`@/` 别名；
- 统一视频时间线：视频、AI 内容、场景、动效、字幕与音频轨道，不区分视频模式和无视频模式；
- 画布支持首个视频自动适配，以及 16:9、9:16、1:1、4:3、自定义分辨率和常用帧率；
- 时间线支持入点/出点选区，AI 内容可在选区起点插入，或精确替换、叠加整个选区；
- 六组参数化动效；“场景”提供黑色条纹、白色边框、网格、聚光等 8 种整画布背景，并写入可独立锁定、隐藏和调整区间的场景轨；普通文字与图表动效继续写入动效轨，默认启用半透明自适应背景，并支持内容、颜色、速度、大小和位置编辑；
- 独立 `.bveffect` 扩展包支持签名校验、安装、升级和卸载；v6 可用纯 JSON 合成短提示音并绑定动效触发点，安装后生成哈希缓存 WAV，预览和 FFmpeg 导出共用同一份触发快照；格式与示例见 `docs/effect-package-format.md`；
- 动效注册表独立位于 `src/domain/effects.ts`，可作为云端模型动效匹配的受限候选库；
- 桌面端本地视频导入、FFprobe 媒体探测、缩略图和音频波形缓存；
- AI 内容支持顺序插入、替换区间和叠加区间；内容生成只写入文案、口播与时间字幕，用户随后可独立调用动效匹配，将场景背景、关键词动效、运镜和双层视频素材分别写入对应时间线轨道；连续 2–5 条同主题字幕可由 AI 自动组成分阶段组合动效，让标题、数据和结论按字幕时间依次出现并保持到组末尾；写入前由本地布局解析器避开同时存在的动效、底部字幕和顶部章节进度，规则见 [`docs/ai-motion-layout.md`](docs/ai-motion-layout.md)；
- 顶部章节进度可按时间字幕本地自动分段，并支持手动修改标题、起点、配色与高度；字幕提供经典、重点强调、简洁无底三种样式及颜色、描边、背景设置，AI 动效匹配会把字幕原文中的短关键词同步为高亮词；
- 视频音轨可由本地 FFmpeg 分离后按原片段时间对齐到独立音效轨，也可另存为 M4A、WAV、MP3 或 FLAC；
- FFmpeg H.264/AAC MP4/MOV 导出，单次可设置分辨率、帧率和编码器，支持视频裁剪、变速、一键运镜、多视频叠加、场景背景、文字动效和字幕合成；
- 工程 JSON 保存和重新打开，持久化本地素材路径；
- 云端模型配置：OpenAI Responses、OpenAI Chat Completions 兼容协议和 Anthropic Messages；内容生成由模型服务决定输出上限，并支持连接测试、模型列表、请求取消、指数退避重试和会话 Token/费用估算；
- 桌面端 API Key 写入应用数据目录下权限受限的凭证文件，模型返回结果通过本地 JSON Schema 校验；
- MiMo 云端语音：`mimo-v2.5-tts` / `mimo-v2.5-tts-voicedesign` 生成配音，`mimo-v2.5-asr` 提取字幕；TTS 与 ASR 共用独立 API Key，桌面端写入应用数据目录；AI 配音按时间字幕逐段生成，每段使用实际 WAV 时长回写字幕、动效和视频图层，再由本地 FFmpeg 合并为一条连续音轨，避免句间错位和片段切换卡顿；
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
npm run generate:icons # 从 macOS 26 风格 SVG 母版重新生成图标集
```

## 本地媒体与云端语音

使用 Node 22 执行 `npm ci`，安装对应平台的 `ffmpeg-static` 与 `@ffprobe-installer/ffprobe`；Tauri 开发和发布构建会自动执行 `prepare:media-sidecars`，把经过 `-version` 校验的工具复制到 `src-tauri/binaries` 并随应用分发。开发启动时若安装脚本未生成二进制，可复用同架构且能通过版本检查的已准备 sidecar；生产构建仍要求依赖完整。客户端按 `BVIDEO_FFMPEG_PATH` / `BVIDEO_FFPROBE_PATH`、应用资源目录、Homebrew 常见目录和 `PATH` 的顺序查找。Windows ARM64 安装包内置 x64 媒体工具，由 Windows ARM 的 x64 仿真层运行。

字幕识别与 AI 配音使用 MiMo V2.5 云端模型，不再要求安装本地 ASR 模型或 Python 环境。在“客户端设置 → 云端语音”中配置 MiMo Base URL、TTS 模型、音色/风格、ASR 模型、识别语言和共用 API Key。API Key 不写入设置 JSON 或工程文件；文本大模型仍在“云端模型”分组中独立配置，因此可继续使用 DeepSeek 等 OpenAI 兼容服务生成文案。

MiMo ASR 目前只接收 WAV/MP3，且单次 Base64 数据上限为 10MB。客户端会通过本地 FFmpeg 转码和分片后顺序识别；服务未提供词级时间戳时，客户端按音频区间与句子长度生成可编辑时间字幕。

视频属性面板只提供全屏、放大至全屏、讲解人圆形右下角、画中画、左右分屏、缓慢推进、区域放大、聚光强调和聚焦放大等一键方案。方案会在当前播放头添加运镜节点，同一视频可依次添加多个节点；每段动画从上一节点的实际位置、大小和形状状态继续过渡。当前节点可以关闭“播放转场动画”，在该时间点直接切换到目标形状和布局；例如在 0 秒添加“讲解人右下角”并关闭动画，视频首帧即为右下角圆形。启用动画时可分别调整过渡时长和聚焦时长；圆形讲解人支持在画布拖动取景中心，屏幕演示支持拖动聚焦点，节点也会显示在时间线和属性列表中。时间线支持以鼠标位置为中心进行滚轮缩放，也保留减号和加号按钮用于精确调整。旧工程中的底层参数仍可兼容读取和导出。

两条创作链路最终共用同一个动效匹配入口：口播视频链路为“视频 → 本地提取音频 → 云端 ASR 时间字幕 → AI 匹配动效”，无视频链路为“AI 文案与口播 → 时间字幕 → AI 匹配动效”。匹配请求会携带字幕绝对时间及 opening / middle / ending 阶段，只允许模型从动效库中选择，并把可见文字压缩为关键词、数字或短结论。模型还可以把连续 2–5 条同主题字幕规划为不重叠的组合动效，同组图层按各自字幕开始出现，并持续到指定字幕末尾。模型坐标只作为布局建议；客户端会根据最终画布比例、文字或图表边界和图层有效时间进行确定性碰撞解析，必要时换位、缩小或舍弃低优先级辅助层。图表结果会在客户端与整组字幕事实二次核对：单个数值只使用计数器，折线图和柱状图必须具备至少两个明确数据点，校验失败时自动降级，避免显示动效模板的示例值。云端文案和动效匹配使用 SSE 流式接收，界面持续显示连接、接收与校验状态；长请求按连接和流空闲分别超时，取消或流中断时不会把不完整结果写入工程。

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
