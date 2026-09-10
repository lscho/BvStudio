# BFrame Studio

基于 Tauri 2、React 19 和 TypeScript 的 AI 视频创作客户端。使用同一个时间线同时处理已有视频和纯 AI 生成内容。

## 功能

- 统一 AI 视频编排：已有字幕时，从字幕「匹配动效」或顶部「AI 视频编排」进入，支持自动混合、纯 A-roll、纯 B-roll 和带工程时间的分镜要求（如 `0-5秒 A-roll；5-12秒 B-roll 用产品截图对比`）。两阶段共用字幕、所选素材、图片识别结果、已有镜头和本地音乐节奏摘要；同一个语义段一次生成现有动效、Shotcraft 镜头、素材绑定、字幕重点词、转场和动作音效。生成结果先展示分镜清单，确认后以一次撤销操作写入视觉、音效和背景音乐。字幕边界不会为了卡点移动；Shotcraft 内部动作和普通动效音效会就近贴合真实拍点。纯 A-roll 需要已放入口播视频，纯 B-roll 保留原口播。图片识别只发送所选图片的缩略图，音乐文件不上传；需人工圈焦点的镜头继续使用独立图片编排入口。详见 [字幕分镜关联](docs/storyboard-linking.md)。

- Shotcraft 镜头库：覆盖 157 张配方卡、216 个镜头实现，支持图片槽、可编辑文案、焦点、停留和 10 种真实前后镜头转场。顶部「AI 镜头编排」按内容、图片和时长两阶段选型，支持图片识别、音乐实际拍点及动作音效编排。168 种镜头可自动选用；另有 48 种含固定示例内容或参考页面坐标，保留手动添加并在属性中标明需适配。新增可见镜头说明、中文强调、真实品牌槽和两态图片校验；「分析拍点」可在未配置 AI 时独立使用。「音效」提供 149 个音效与 5 首音乐的搜索、试听和添加。预览与逐帧导出共用实现，无需 Remotion。使用步骤与具体边界见 [Shotcraft 镜头](docs/shotcraft.md)。

- 素材动效：先添加动效，再在检查器中导入、选择已有素材或从媒体区拖入；支持排序、替换、移除、撤销和重做，首次填满必需槽位后自动播放。「3D 海报墙」支持 2–12 张图片，「双图展示」左、右各 1 张；「人物聚焦卡」手动关联一个视频后，会读取同素材时间线片段的实际位置、缩放和形状，再动画移动到人物框；素材尚未上时间线时从全画布开始。Overlay Studio 迁入的录屏、截图、头像、图标等素材也统一从工程素材槽选择；素材不足时使用半透明素材占位，占位内容不会写入工程。上述素材动效为透明前景，可自由叠加独立背景；Shotcraft 镜头自带整屏底色。
- 素材动效与独立背景均支持「整体变换」：水平／垂直位置、30%–300% 缩放、旋转、不透明度和重置。选中后可在画布拖动位置或使用边缘手柄等比缩放；每次拖动支持撤销／重做，锁定后不可调整。整体变换不改变内部素材排列或镜头运动，预览与导出使用同一变换数据。
- 「展示」分组提供动势缩放（2–10 个素材）、横向轮播（2–8 个）、叠卡翻展（2–8 个）、分屏揭幕（2–4 个），支持图片和视频混合绑定，持续时间可设为 2–10 秒，并可选择完整显示或裁切填满。视频静音播放，短素材停在末帧；推荐 H.264 MP4 或 WebM，其他编码取决于运行时解码能力，暂不支持嵌套动效。
- 「背景」分组提供斜向条纹、透视方格、点阵律动、等高线，无需素材即可播放，可独立调整时间、配色、密度和流动幅度。默认层级为背景 0、视频 20、普通动效 220，数值越大越靠上；在属性中可输入 0–1000 调整层级。动效库中的背景预览也在视频下方合成，并保留时间线前景图形；普通动效预览仍单独展示。动效与音效分组默认折叠，点击分组展开。
- 视频导入及从素材库加入时间线时，容器始终根据素材的实际显示方向和宽高比自动计算；带旋转元数据的手机视频也会按竖屏尺寸识别。视频属性不再提供画面适配、容器宽高和手动匹配比例，大小通过整体缩放或画布手柄调整，位置和取景中心仍可单独修改。预览与导出共用同一套尺寸规则。
- 素材与背景场景使用同一 Three.js / Canvas 确定性渲染器预览及逐帧导出。拆分和裁剪保留原运镜时间；桌面导出等待视频逐帧解码，按帧写入临时缓存后由 FFmpeg 合成，可取消并清理缓存。浏览器支持素材导入与预览，保存后的无源路径素材需重新定位，成片导出仍需桌面端。
- 工程格式升级为 schemaVersion 32，兼容 v1–v31：新增音乐分析缓存、Shotcraft 分段卡点时钟及转场前导停留，保留版本化的焦点区域、额外停留与转场配置；支持独立字幕主题色，旧工程补齐默认色并保留各条字幕原有颜色；保存自由定位的人物避让区，保留旧工程的左、中、右避让位置；兼容读取旧视频容器尺寸，并将旧版相对层级迁移为实际层级。旧 `effect`/`effectId` 转成 `composition`/`compositionId`，旧版海报墙与双图展示的背景拆为独立背景片段，保留素材绑定和原运镜时间。旧场景背景迁移为背景动效，保留时间、分组及原轨道的锁定、隐藏和静音状态；空场景轨道移除。新文件不保存会话 URL。AI 动效匹配按素材槽约束选择已导入图片或视频。

- Tauri 2 + React 19 + TypeScript（strict），Vite 端口 `1420`，`@/` 别名；
- 统一视频时间线：视频、动效、字幕与音频轨道，不再单独显示场景轨道和 AI 内容行；背景也是独立动效，仍按原层级合成，不区分视频模式和无视频模式。AI 原文、口播稿和关联数据继续保存在工程中，可从左侧「字幕 → 脚本记录」选择并编辑；
- 同一轨道内，不同时段的场景组复用相同编辑行，仅重叠片段自动分行，不再为每组增加标题行和总览行；轨道仍可折叠。点击单条编辑该动效，工具栏「选择整组动效」后拖动成员可整体移动，拖动单条边缘只裁剪该条。双击分组成员或点击「聚焦场景组」可只显示该组并放大时间范围、定位播放头；返回按钮或 Escape 恢复完整时间线原来的缩放和滚动位置。属性中可精确输入开始时间、结束时间和播放时长：结束时间裁剪片段，播放时长按比例调整动效节奏，整组时长在组属性中调整。所有时间输入在失焦或回车时提交，支持撤销/重做；
- 配音窗口根据选中字幕定位所属脚本，使用该脚本的时间字幕；跨脚本或混合独立字幕的选区只使用所选字幕，不关联错误脚本。未明确选择时优先使用播放头所在的唯一脚本，多脚本之间的空白处不再默认选择第一份脚本。配音目标在打开窗口时确定，不随后续播放或选择变化；
- 时间线上边界可拖动调整高度，轨道标签与片段同步纵向滚动。内容溢出时普通滚轮纵向滚动，Ctrl/Cmd + 滚轮缩放；内容未溢出时保留普通滚轮缩放，也可使用加减按钮；
- 画布支持首个视频自动适配，以及 16:9、9:16、1:1、4:3、自定义分辨率和常用帧率；
- 时间线支持入点/出点选区，AI 内容可在选区起点插入，或精确替换、叠加整个选区；
- 动效统一为独立的 Composition 片段，不再向视频或贴图附加 Effect。内置 Overlay Studio 的全部 102 个动效，另有 6 个素材展示和 4 个独立背景。除章节导航条与双语字幕轨保持手动添加外，其余动效（包括人物聚焦卡和素材动效）全部进入 AI 自动匹配目录；旧版文字、图表和组合场景定义仅在打开已有工程时兼容解析；
- 独立 `.bveffect` 扩展包支持签名校验、安装、升级和卸载；v6 可用纯 JSON 合成短提示音并绑定动效触发点，安装后生成哈希缓存 WAV，预览和 FFmpeg 导出共用同一份触发快照；格式与示例见 `docs/effect-package-format.md`；
- 动效按分类控制可用范围：常规分类内前 10 个动效免费，「展示」分类只保留这 10 个免费动效、其余整体并入「高级」分类，布局与数据的第 11 个起留在原分类但需要 Pro；「高级」分类收录 3D 空间、复杂运镜与展示类进阶动效，全部需要 Pro。需要 Pro 的动效仍可在画布中预览，条目右侧加号变成锁定的 `PRO` 按钮，点击进入「会员与授权」；AI 动效与镜头编排只向模型提供当前身份可用的候选，并在应用预览前再次校验授权；规则与维护约定见 [`docs/effect-access.md`](docs/effect-access.md)；
- 动效元数据集中在 `src/domain/effects.ts`，React 卡片注册与参数控件集中在 `src/compositions/registry.tsx`；预览和导出复用同一组件树，并由整数微秒播放头计算确定性帧。102 个 Overlay Studio 动效中，20 个沿用 BVideo 原有专属实现，另外 82 个通过参考组件适配层接入；各组件的专属参数随工程文件保存。结构化内容使用 `｜`、`|` 或换行分隔，模板按播放头逐项显现并保持在场。点击动效条目会在中央画布播放临时预览，重复点击可重新播放，只有条目右侧加号会把动效添加到播放头；需要素材的动效会优先使用项目素材，数量不足时补充半透明素材占位，预览不写入工程或撤销栈。“动效”Tab 顶部的 6 个色块是统一主题色入口，后续手动添加和 AI 匹配的动效采用该颜色；画布设置仅保留成片规格，旧工程的主题样式继续保留。字幕颜色统一在全局字幕样式中设置，文字、关键词、背景和描边均从固定色值中选择，并应用到全部未锁定字幕及后续生成、识别的字幕，支持撤销/重做。动效匹配只更新高亮词，不覆盖字幕配色；单个动效仍可设置独立颜色；
- Overlay Studio 动效沿用参考项目的卡片材质、图表几何、文字层级、入场距离和缓动曲线，统一按参考像素缩放到横屏、竖屏与方形预览及输出画布。82 个参考组件保持完整舞台固定居中，AI 和手动编辑都通过卡片内部的参考落位、偏移与缩放调整实际内容，选择框按卡片真实边界显示，不会再把完整舞台二次移动到画布外。排版重组连续插值、钉板回弹、终端打字、光标闪烁和卡内视频均跟随播放头，支持暂停及向前或向后定位；导出会等待卡内视频目标帧解码，并覆盖延迟出现的条目、连续背景和完整动画末帧。字体仍采用工程主题与系统可用字体，细边框在缩小预览时由浏览器取整；内部透明帧只包含动效自身，毛玻璃不会将底层视频的背景模糊烘焙进成片；
- 桌面端本地视频导入、FFprobe 媒体探测、缩略图和音频波形缓存；
- AI 内容支持顺序插入、替换区间和叠加区间；内容生成只写入文案、口播与时间字幕，用户随后可独立调用两阶段动效匹配。第一阶段把字幕连续覆盖为通常 10–30 秒、每段一个论点的语义段，0–5 秒强制建立钩子，并从完整自动动效目录中按用途、触发条件、证据形态、层级和素材需求选型；第二阶段只在已选卡中分配工程素材、证据来源、短文案、运镜、位置与字幕节奏锚点。超过 80 条字幕时会在停顿或句末边界自动分批并映射回全局索引，不丢字幕。缺少图片或录屏时仍插入真实动效片段并显示半透明“待补素材”占位，不使用示例图或虚构路径。全部逐项、逐词、多阶段、计数、滚动和动作剧本时间参数由客户端根据字幕真实时间计算；第一阶段选中的每张卡必须在段内恰好落盘一次，同段强调色统一，同场景最多累积 2 个内容层且进场至少错开 0.5 秒。无字幕数据依据的图表会触发 AI 自动修正，最终不会被静默替换成未选中的简单卡。导入视频的现有角色和关联字幕摘要会参与 A-roll/B-roll 判断，写入前由本地预检阻止分段空洞、相邻同 kind、独占叠层、双背景、越界锚点、缺失选型、重复状态及无来源证据，再由布局解析器避开底部字幕、章节进度和已有动效，规则见 [`docs/ai-motion-layout.md`](docs/ai-motion-layout.md)；
- 章节进度既可按时间字幕本地分段，也可由云端模型根据字幕内容与真实时间边界进行语义分章；生成结果会先进入可编辑章节列表。章节条提供顶部/底部、深色/浅色、分段、极简线、步骤点和章节标签预设，并支持自定义位置、标题显示、配色、透明度与高度；默认预设针对手机观看增大栏高和标题字号，FFmpeg 导出按输出帧率连续绘制当前章节进度。字幕提供经典、重点强调、简洁无底三种样式及颜色、描边、背景设置。AI 会独立返回字幕高亮词与动效展示文案：高亮词必须逐字存在于当前字幕，动效文案则可生成不虚构事实的概括、结论或补充标签；
- 视频音轨可由本地 FFmpeg 分离后按原片段时间对齐到独立音效轨，也可另存为 M4A、WAV、MP3 或 FLAC；
- 「匹配」分别位于动效和音效 Tab 底部；字幕 Tab 底部保留生成与配音。动效匹配不添加音效，也不清除已有音效；音效匹配只更新所选字幕对应的音效轨内容，无字幕选区时匹配全部字幕（单次最多 80 条），保留锁定音效和未选范围。资源面板内置片头冲击、快切甩镜、字幕弹出、重点重音、高光闪亮、悬念上升和片尾收束等音效，可试听或手动加入；独立 AI 音效匹配从同一白名单中稀疏选择，连续场景最多一个且相邻音效至少间隔 2.5 秒。内置立体声 WAV 在使用时生成，桌面端缓存后供预览与 FFmpeg 导出共用；
- 动效 Tab 底部的历史按钮可查看匹配记录，对比 AI 初选与之后的删除、替换、时长、位置、大小、素材和层数变化。记录不包含素材路径或预览 URL，只有用户点击“采纳为偏好”后才会作为后续选型、时长和位置的软参考，当前字幕证据、素材槽、安全区与互斥规则始终优先；
- FFmpeg H.264/AAC MP4/MOV 成片导出，单次可设置分辨率、帧率和编码器；React 动效会在客户端按虚拟时间逐帧写入内部 RGBA PNG 缓存，落定后复用末帧，随后与视频、字幕和音频合成，产品不提供独立透明图层导出模式。导出前会执行动效 lint，阻止未知动效、非法时间和场景层数超限；默认使用高质量编码参数，中间片段以高质量临时编码生成并通过流复制合并，减少重复有损压缩；
- 工程 JSON 保存和重新打开，持久化本地素材路径；
- 云端模型配置：OpenAI Responses、OpenAI Chat Completions 兼容协议和 Anthropic Messages；内容生成由模型服务决定输出上限，并支持连接测试、模型列表、请求取消、指数退避重试和会话 Token/费用估算；
- Shotcraft 自动修复会反馈具体镜头、文案字段、区域和动作事件，并校验重复选型；约 50 秒的真实云端实测记录与内容审查边界见 [Shotcraft 验证](docs/shotcraft.md#本轮验证)。
- 桌面端 API Key 写入应用数据目录下权限受限的凭证文件，模型返回结果通过本地 JSON Schema 校验；
- MiMo 云端语音：`mimo-v2.5-tts` / `mimo-v2.5-tts-voicedesign` 生成配音，`mimo-v2.5-asr` 提取字幕；TTS 与 ASR 共用独立 API Key，桌面端写入应用数据目录；AI 配音以时间字幕作为唯一文本源逐段生成，每段使用实际 WAV 时长回写字幕、动效和视频图层，再由本地 FFmpeg 合并为一条连续音轨。新配音默认使用 `1.5×` 导出增益；预览使用原生多轨播放并将单轨音量限制为 `1×`，确保配音、音乐和音效可同时播放。导出时先统一人声响度再应用片段音量；客户端会校验合并音频时长与全部逐句音频之和，异常时停止写入，避免文案分叉、句间错位、语音缺失和片段切换卡顿；
- 设置持久化：桌面运行时走 `@tauri-apps/plugin-store`（`settings.json` / `preferences`），浏览器预览走 `bframe-studio:` 命名空间 `localStorage`，损坏数据回退默认值；
- 原生窗口集成：仅 Windows 显示最小化/最大化/关闭按钮，macOS 保留原生红绿灯；标题栏可拖拽（`data-tauri-drag-region`）；debug 构建支持 F12 / Cmd-or-Ctrl+Shift+I 切换 DevTools；
- 签名应用内更新：`@tauri-apps/plugin-updater`，普通更新显示入口，`isForceUpdate` 启动即强制覆盖；
- 发布：`.github/workflows/build-desktop.yml` 构建五个平台（Windows x64/ARM64、macOS Intel/Apple Silicon、Linux x64）的签名安装包与更新包，并把 `desktop-release-manifest.json` 上传到 GitHub Release；更新服务由 `edge/` 的 ESA 边缘函数提供，清单经 `npm run esa:import-release` 校验导入。

## 本地命令

```bash
npm ci                 # 安装依赖（Node >=22 <23）
npm run dev            # 浏览器预览（http://localhost:1420，无原生窗口/更新请求）
npm run typecheck      # TypeScript 类型检查
npm test               # 前端单元测试（vitest）
npm run test:release   # 发布脚本测试（node --test）
npm run prepare:media-sidecars # 准备安装包内置的 FFmpeg/FFprobe
npm run prepare:shotcraft-assets -- "$HOME/.codex/skills/video-shotcraft" # 从本地技能准备 Shotcraft 音频
npm run build          # 前端生产构建（默认 VITE_ENABLE_UPDATER 关闭）
npm run desktop:dev    # 桌面开发运行（tauri dev）
npm run desktop:build  # 桌面 release 构建（未配置签名/更新端点）
npm run generate:icons # 从 macOS 26 风格 SVG 母版重新生成图标集
node scripts/sync-motion-matching-catalog.mjs --source "../overlay-studio-pro/.agents/skills/overlay-fx-generator/SKILL.md" # 同步参考动效匹配卡表及默认编排策略
```

## 本地媒体与云端语音

使用 Node 22 执行 `npm ci`，安装对应平台的 `ffmpeg-static` 与 `@ffprobe-installer/ffprobe`；Tauri 开发和发布构建会自动执行 `prepare:media-sidecars`，把经过 `-version` 校验的工具复制到 `src-tauri/binaries` 并随应用分发。开发启动时若安装脚本未生成二进制，可复用同架构且能通过版本检查的已准备 sidecar；生产构建仍要求依赖完整。客户端按 `BVIDEO_FFMPEG_PATH` / `BVIDEO_FFPROBE_PATH`、应用资源目录、Homebrew 常见目录和 `PATH` 的顺序查找。Windows ARM64 安装包内置 x64 媒体工具，由 Windows ARM 的 x64 仿真层运行。

字幕识别与 AI 配音使用 MiMo V2.5 云端模型，不再要求安装本地 ASR 模型或 Python 环境。在“客户端设置 → 云端语音”中配置 MiMo Base URL、TTS 模型、音色/风格、ASR 模型、识别语言和共用 API Key。API Key 不写入设置 JSON 或工程文件；文本大模型仍在“云端模型”分组中独立配置，因此可继续使用 DeepSeek 等 OpenAI 兼容服务生成文案。

MiMo ASR 目前只接收 WAV/MP3，且单次 Base64 数据上限为 10MB。客户端会通过本地 FFmpeg 转码和分片后顺序识别；字幕优先按句末标点分句，长句优先在逗号、分号等分句边界拆分，再按中英文词语边界控制长度，保留句末标点与闭引号。服务未提供词级时间戳时，客户端按各音频区间与分句长度估算可编辑字幕时间，不能保证逐词精确对齐；已有字幕需重新识别才能应用新的断句规则。

导入或从素材库加入视频时，容器会按素材实际显示尺寸等比缩放到画布范围内。竖屏素材放入横屏画布时，容器本身就是竖屏比例，不会在素材外生成黑色背景；带 90°/270° 旋转元数据的视频按旋转后的方向计算。选中视频后可调整缩放和水平／垂直位置，也可拖动画布中的视频与缩放手柄；编辑支持撤销／重做，锁定后不可调整。当前存在运镜节点时调整该节点的目标大小，已有位置关键帧时写入当前帧，预览与导出共用相同数据。AI 自动运镜保留素材比例、手动大小和播放速度，已有位置关键帧或运镜节点的片段不再叠加自动运镜。旧工程中保存的普通视频容器宽高在素材尺寸可用时不再参与渲染。

视频属性面板还提供全屏、放大至全屏、讲解人圆形右下角、画中画、左右分屏、缓慢推进、区域放大、聚光强调和聚焦放大等一键方案。方案会在当前播放头添加运镜节点，同一视频可依次添加多个节点；每段动画从上一节点的实际位置、大小和形状状态继续过渡。当前节点可以关闭“播放转场动画”，在该时间点直接切换到目标形状和布局；例如在 0 秒添加“讲解人右下角”并关闭动画，视频首帧即为右下角圆形。启用动画时可分别调整过渡时长和聚焦时长；圆形讲解人支持在画布拖动取景中心，屏幕演示支持拖动聚焦点，节点也会显示在时间线和属性列表中。常规片段转场可直接在视频或贴图属性中设置；时间线多选连续的视觉素材后，还可把同一转场一次应用到选区内部的全部相邻切点，包括跨轨道的视频与贴图。「动势缩放」的新建入口已移到动效库的「展示」分组，直接关联多个素材并连续缩放切换；旧工程已设置的动势缩放片段转场仍兼容预览与导出。连续导入或从素材库依次加入视觉素材时，新素材默认接在当前选中素材末尾，连续视频会优先复用同一视频轨道；显式叠加放置仍会保留多轨布局。时间线支持以鼠标位置为中心进行滚轮缩放，也保留减号和加号按钮用于精确调整。旧工程中的底层参数仍可兼容读取和导出。

两条创作链路最终共用同一个动效匹配入口：口播视频链路为“视频 → 本地提取音频 → 云端 ASR 时间字幕 → AI 语义选型 → 素材与时间线编排”，无视频链路为“AI 文案与口播 → 时间字幕 → AI 语义选型 → 素材与时间线编排”。请求会携带字幕绝对时间、opening / middle / ending 阶段，以及导入视频的角色提示、尺寸、时长和关联字幕摘要。第一阶段接收完整动效名称、简介与匹配知识；第二阶段保留素材槽、卡内参数和时间锚点，不以精简字段牺牲匹配能力。模型结构或语义计划首次校验失败时，客户端会附带精简错误自动请求修正一次，并累计两次请求的 Token 用量。模型返回的高亮关键词必须来自字幕原文，动效文案可以概括但不得虚构数字或事实；图表结果还会与整组字幕事实二次核对。模型坐标只作为布局建议，客户端根据最终画布比例、图层有效时间和安全区进行确定性碰撞解析。人物避让框支持拖动、缩放、方向键微调、撤销和重做，播放、动效预览与导出时自动隐藏。云端文案和动效匹配使用 SSE 流式接收，界面持续显示连接、接收、自动修正与校验状态；取消或流中断时不会把不完整结果写入工程。

构建带签名与更新端点的本地发布包：

```bash
set -a && . ./.env.production && set +a   # 载入 VITE_ENABLE_UPDATER / VITE_LICENSE_SERVER_URL / VITE_LICENSE_RESPONSE_KEY
export RELEASE_VERSION=0.1.0
export TAURI_SIGNING_PUBLIC_KEY='<公钥>'
export TAURI_SIGNING_PRIVATE_KEY='<私钥>'
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<可选密码>'
export RUNNER_TEMP="$(mktemp -d)"
npm run release:config
npm run tauri -- build --config "$RUNNER_TEMP/bframe-studio-release/tauri.release.conf.json"
```

`release:config` 只把版本与更新器设置写入 `$RUNNER_TEMP/bframe-studio-release/tauri.release.conf.json` 临时覆盖文件，**不会**修改提交的 `src-tauri/tauri.conf.json`。

更新端点不需要单独配置：脚本从 `VITE_LICENSE_SERVER_URL` 取出 origin，自动拼成 `{origin}/api/desktop-updates/latest?platform={{target}}`（同样的域名也供前端授权服务使用）。因此它要求该变量只填 origin，带路径会直接报错。`VITE_ENABLE_UPDATER` 严格等于 `"true"` 时才写入端点，否则端点为 `[]`——这与客户端 `src/services/updater.ts` 的判定一致，避免出现「端点已配置但被前端挡住」的死配置。两者都未配置时 GitHub Actions 仍会生成签名发布产物，只是客户端不会发起更新请求。

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_ENABLE_UPDATER` | `.env` / GitHub 仓库变量（示例见 `.env.example` / `.env.production.example`） | 严格 `"true"` 才允许客户端发起更新检查，同时决定发布配置是否写入更新端点；浏览器预览与默认构建保持关闭 |
| `VITE_LICENSE_SERVER_URL` | 发布构建环境变量 / GitHub 仓库变量 | ESA 边缘函数域名，**只填 origin**。同时驱动会员授权接口与桌面更新端点；未配置时更新端点为 `[]`、会员状态退回本地缓存模式 |
| `VITE_LICENSE_RESPONSE_KEY` | 发布构建环境变量 / GitHub Secret | 授权响应 HMAC 验签密钥，与 `edge/config.js` 的 `HMAC_SECRET` 一致；与上一条必须同时配置 |

## GitHub 变量 / Secrets

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `VITE_ENABLE_UPDATER` | Variable（可选） | 设为 `true` 才启用客户端更新检查；未设置时构建出的客户端不检查更新 |
| `VITE_LICENSE_SERVER_URL` | Variable | ESA 边缘函数域名（只填 origin），同时供会员授权与桌面更新端点使用 |
| `VITE_LICENSE_RESPONSE_KEY` | Variable 或 Secret | 授权响应 HMAC 验签密钥，与 `edge/config.js` 的 `HMAC_SECRET` 一致 |
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
4. 取回 `desktop-release-manifest.json`，执行 `npm run esa:import-release -- --manifest <path> --notes "<更新说明>"` 校验并导入 EdgeKV，客户端随即可查到新版本；完整步骤见 [`docs/desktop-release-operations.md`](docs/desktop-release-operations.md)。

生成的安装包 / 更新包对：

| 平台 | 安装包 | 更新包（Release 资产） |
| --- | --- | --- |
| `windows-x86` | NSIS 签名 `.exe` | 同一个 `.exe`（NSIS 被动安装） |
| `windows-arm` | NSIS 签名 `.exe` | 同一个 `.exe` |
| `macos-x86` | `.dmg` | `BFrame Studio_x64.app.tar.gz` + `.sig` |
| `macos-arm` | `.dmg` | `BFrame Studio_arm64.app.tar.gz` + `.sig` |
| `linux-x86` | `.AppImage`（同时发布 `.deb`） | `{AppImage 文件名}.tar.gz` + `.sig` |

命名口径分三层，不要混淆（macOS 部分已由真实打包确认）：

- **`.app` 目录名与安装包名**取 `tauri.conf.json` 的 `productName`（`BFrame Studio`）。Tauri 生成 `BFrame Studio.app.tar.gz`，CI 再追加架构后缀得到 `BFrame Studio_arm64.app.tar.gz`。
- **可执行文件名**取 Cargo 包名（`bframe-studio`），即 `BFrame Studio.app/Contents/MacOS/bframe-studio`；Windows 安装后同样是 `bframe-studio.exe`。
- **CI 产物目录前缀**是 `bframe-studio-`（如 `bframe-studio-macos-arm64`）。`.github/workflows/build-desktop.yml` 的 matrix `artifact` 与 `scripts/build-desktop-release-manifest.mjs` 的 `artifactDirectory` 必须严格一致，否则 `prepare-release` 直接失败。

各平台最终文件名以 `desktop-release-manifest.json` 的 `fileName` 为唯一权威，`npm run esa:import-release` 按它写入 EdgeKV。

体积参考（macOS arm64 实测）：更新包约 67MB，解压后 App 约 104MB，其中 ffmpeg/ffprobe 两个 sidecar 合计 60MB。Tauri updater 是全量替换、无差分更新，所以每次发版这部分都要重下。

bundle identifier 为 `com.bframe.studio`。它决定 macOS 的签名/公证身份与 Windows 的卸载注册表项，**一旦有用户安装后就不可再改**——改动会被操作系统视为另一个应用，导致已安装用户无法升级、卸载记录无法匹配。当前尚无安装用户，因此与品牌相关的命名（存储键前缀 `bframe-studio:`、工程扩展名 `.bframe.json`、签名上下文 `bframe-license-v1`）已一次性统一到 BFrame。

## 更新服务协议

客户端与更新服务的精确契约见 [`docs/updater-api.md`](docs/updater-api.md)：`GET /api/desktop-updates/latest?platform={{target}}`，`204` 是无更新的正常结果。服务端与会员授权共用同一个 ESA 边缘函数（`edge/`）与 EdgeKV 命名空间，每个平台一条 `release:latest:{platform}` 记录；发布记录由 `npm run esa:import-release` 从发布清单导入，操作步骤见 [`docs/desktop-release-operations.md`](docs/desktop-release-operations.md)。

更新端点地址不需要单独配置：发布构建时由 `scripts/write-tauri-release-config.mjs` 从 `VITE_LICENSE_SERVER_URL` 推导，前端授权服务与 Rust 更新器消费同一个域名变量。

## 会员授权

客户端"设置 → 会员与授权"通过卡密兑换升级 Pro：一张卡密绑定一台设备（按硬件码），兑换、核验、吊销与离线宽限期规则见 [`docs/license-api.md`](docs/license-api.md)，卡密生成/导入/清理命令见 [`docs/license-card-operations.md`](docs/license-card-operations.md)。服务端由阿里云 ESA 边缘函数 + EdgeKV 实现，源码在 `edge/`，快捷命令：`npm run esa:import`（生成并入库）、`npm run esa:clear-kv`（清空 KV）。
