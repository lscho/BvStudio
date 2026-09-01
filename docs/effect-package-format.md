# BVideo `.bveffect` 格式规范

`.bveffect` 是包含声明式动效与短音效配方的 UTF-8 JSON 文件。它不能执行 JavaScript、不能加载远程资源、也不能调用本地命令。当前 `schemaVersion` 为 `6`（版本 `1` 至 `5` 仍然受支持），文件上限 2 MB、最多 100 个效果和 32 个音效。

Schema v6 新增声明式短音效与动效触发点。音频由桌面端根据受限参数确定性生成，包内不包含媒体二进制。此前版本增加的关键帧、伪 3D、图表和场景背景仍然受支持。

1. **扩展缓动曲线集**与**逐关键帧缓动**;
2. **伪 3D 关键帧通道**(`rotateX`、`rotateY`、`perspective`);
3. 声明式**图表规格(chart)**,以确定性数据动画渲染。

## 顶层字段

```json
{
  "schemaVersion": 6,
  "manifest": {
    "id": "publisher-pack",
    "name": "Publisher Pack",
    "version": "1.0.0",
    "author": "Publisher",
    "description": "Short description"
  },
  "sounds": [],
  "effects": [],
  "signature": {
    "algorithm": "ed25519",
    "publicKeyBase64": "...",
    "signatureBase64": "..."
  }
}
```

## 声明式音效（schema v6）

顶层 `sounds` 包含音效定义。每个音效时长为 `50000..3000000` 微秒，包含 1 到 8 个合成层；支持 `sine`、`triangle`、`square` 和 `noise` 波形。频率范围为 `20..20000` Hz，图层音量为 `0..1`。所有图层必须落在音效总时长内。

```json
{
  "id": "notice-soft",
  "name": "柔和提示",
  "durationUs": 650000,
  "layers": [
    {
      "waveform": "sine",
      "startOffsetUs": 0,
      "durationUs": 650000,
      "startFrequencyHz": 740,
      "endFrequencyHz": 880,
      "volume": 0.28,
      "attackUs": 8000,
      "releaseUs": 420000
    }
  ]
}
```

效果通过可选的 `soundCues` 引用同包音效：

```json
"soundCues": [
  { "soundId": "notice-soft", "offsetUs": 0, "volume": 0.55 }
]
```

`soundId` 必须引用同包 `sounds` 中的 ID；`offsetUs` 必须落在效果默认时长内，`volume` 为 `0..1`。安装或加载动效包时，BVideo 会生成 48 kHz 单声道 PCM WAV 并按内容哈希缓存。动效进入工程后会保存已解析的触发快照，因此后续更新或卸载来源包不会移除已有工程所需的缓存音效。

`manifest.id` 与每个效果本地的 `id` 只能使用小写 ASCII 字母、数字、`-` 或 `_`。包版本使用严格 SemVer。安装后效果 ID 会加上命名空间前缀,格式为 `manifest.id:effect.id`;新包版本不得低于已安装版本,如需回退请先卸载当前包。

## 效果字段

每个效果包含 `id`、`name`、`category`、`description`、`tags`、`defaultDurationUs`、`defaultText`、`defaultColor`、`defaultAccentColor` 和 `recipe`。颜色使用六位十六进制表示。支持的分类为 `标题`、`强调`、`卡片`、`标注`、`布局` 和 `场景`。

配方(recipe)字段及取值范围:

| 字段 | 取值 |
| --- | --- |
| `layout` | `highlight`、`number`、`panel`、`underline`、`frame` |
| `entrance` | `slide-left`、`fade-up`、`pop`、`none` |
| `paddingX`、`paddingY` | `0..100` |
| `borderWidth` | `0..20` |
| `borderRadius` | `0..40` |
| `backgroundOpacity` | `0..1` |
| `sceneBackground` | Schema v5 可选的整画布场景背景，且分类必须为 `场景` |

Schema v2 及以上的配方可以包含可选的 `animation` 关键帧对象:

```json
{
  "durationSeconds": 0.55,
  "easing": "ease-out",
  "keyframes": [
    { "offset": 0, "translateX": 0, "translateY": 35, "scale": 0.88, "rotation": -3 },
    { "offset": 1, "translateX": 0, "translateY": 0, "scale": 1, "rotation": 0 }
  ]
}
```

`durationSeconds` 取值 `0.05..10`。传统缓动名称 `linear`、`ease-in`、`ease-out`、`ease-in-out` 在所有 schema 版本中均有效;schema v4 额外接受 `cubic-in`、`cubic-out`、`cubic-in-out`、`quart-out`、`back-in`、`back-out`、`back-in-out`、`circ-out`、`elastic-out` 和 `bounce-out`。配方包含 2 到 16 个关键帧,`offset` 在 `0` 到 `1` 之间严格递增,首帧必须恰为 `0`,末帧必须恰为 `1`。位移(relative to overlay size)范围 `-400..400` 百分比,缩放 `0.05..5`,旋转 `-720..720` 度。编辑器预览与 FFmpeg 导出按同一套关键帧求值,所见即所得。

Schema v4 的关键帧还可以携带以下字段:

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `easing` | 上表中的任意曲线名 | 覆盖动画级缓动,作用于**止于该关键帧的区段** |
| `rotateX`、`rotateY` | `-80..80` 度 | 伪 3D 倾斜;预览呈现为 CSS 3D 变换,导出为各轴前向缩短(`cos(tilt)`)——是平面图层近似,并非真实单应变换 |
| `perspective` | `200..4000` | 预览端倾斜效果的透视距离;导出仅使用前向缩短近似 |

## 图表规格(schema v4)

配方可以声明可选的 `chart` 对象。存在该字段时,它会取代纯文本层,渲染为程序化数据图形;预览与 FFmpeg 导出都把它作为"播放进度的确定性函数"渲染,因此时间轴上拖动播放头看到的就是导出成片的内容。

```json
{
  "kind": "bar",
  "series": [32, 48, 41, 76],
  "comparison": [24, 39, 44, 52],
  "categories": ["一月", "二月", "三月", "四月"],
  "maxY": 100,
  "gridLines": 3,
  "unit": "",
  "durationSeconds": 1.4
}
```

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `kind` | `counter`、`bar`、`donut`、`line` | 必填 |
| `startValue`、`endValue` | 有限数值 | 计数器区间(缺省时取 `series` 求和) |
| `series` | 最多 24 个有限数值 | 柱条 / 环形扇区 / 折线数据点 |
| `comparison` | 最多 24 个有限数值 | 可选的第二组柱状系列,在主系列旁并列展示 |
| `categories` | 每项不超过 20 字符 | 坐标轴或图例标签 |
| `maxY` | `> 0` | 数值轴上限;缺省时自动取序列的圆整最大值 |
| `gridLines` | `0..5` | 水平网格线数量(`bar` / `line`) |
| `prefix`、`suffix`、`unit` | 不超过 8 字符 | 渲染在数字前后 |
| `decimals` | `0..4` | 渲染数值的小数位数 |
| `durationSeconds` | `0.05..30` | 展开动画时长(默认 `1.2`),随后随片段速度进一步缩放 |

图表的文字样式复用配方本身:`color` 用于标签与图形内文字,`accentColor` 用于柱条、圆弧与计数主体,`backgroundOpacity`、`borderWidth`、`borderRadius` 保持原有的卡片语义。效果的显示文字在 `bar`、`donut`、`line` 图表上方会渲染为一行小标题,`counter` 类型则忽略文字。

## 场景背景（schema v5）

场景背景位于视频、字幕和普通动效下方，可在同一时间线区间内为整幅画布提供统一视觉环境。它在加入工程后写入独立的“场景”轨，可与“动效”轨分别锁定、隐藏、移动和裁剪。扩展包仍使用 `category: "场景"`，并在 `recipe.sceneBackground` 中声明：

```json
{
  "preset": "black-stripes",
  "primaryColor": "#111317",
  "secondaryColor": "#252a31",
  "borderColor": "#5fa8ff",
  "intensity": 0.72
}
```

`preset` 支持 `black-stripes`、`white-frame`、`dark-grid`、`clean-white`、`spotlight`、`blueprint`、`paper-lines` 和 `contrast-side`；三个颜色字段使用六位十六进制，`intensity` 取值 `0.1..1`。场景背景不能同时声明 `kind: "scene"` 或 `sceneLayers`。

## 组合场景模板

Schema v3 及以上可以定义可复用的多效果场景。场景使用 `category: "场景"`、`kind: "scene"`,以及一个包含 2 到 8 个同包原子效果的 `sceneLayers` 数组。不允许嵌套场景。图层引用在安装时会自动加命名空间前缀。组合场景模板会展开为普通动效片段，不会写入场景背景轨。

```json
{
  "id": "intro-scene",
  "name": "Intro scene",
  "category": "场景",
  "kind": "scene",
  "description": "A title and subtitle combination",
  "tags": ["intro", "subtitle"],
  "defaultDurationUs": 4000000,
  "defaultText": "Main title",
  "defaultColor": "#ffffff",
  "defaultAccentColor": "#47d7ac",
  "recipe": { "layout": "frame", "entrance": "none", "paddingX": 10, "paddingY": 10, "borderWidth": 1, "borderRadius": 2, "backgroundOpacity": 0.2 },
  "sceneLayers": [
    { "effectId": "title", "x": 50, "y": 35, "fontSize": 60, "zIndex": 30 },
    { "effectId": "subtitle", "x": 50, "y": 65, "scale": 0.7, "zIndex": 20, "startRatio": 0.2 }
  ]
}
```

图层的必填字段是 `effectId`、`x`、`y` 和 `zIndex`;可选字段是 `text`、`scale`、`rotation`、`opacity`、`fontSize`、`startRatio` 和 `durationRatio`。安装后的组合场景模板与内置组合模板一样参与本地字幕检索和云端 AI 候选选择。

安装示例参见 [`examples/effects/starter-pack.bveffect`](../examples/effects/starter-pack.bveffect)(未签名的可安装示例)。

## 签名

对于签名包:先移除完整的 `signature` 属性,将剩余 JSON 以与 `serde_json::to_vec` 相同的紧凑序列化语义写出,用 Ed25519 对这些字节签名,然后把 32 字节原始公钥与 64 字节原始签名以 Base64 存入。

签名用于证明包的完整性并标识签名密钥指纹。BVideo 目前不维护发布者信任库,因此有效自签名的包并不构成对其作者的背书。未签名的包需要用户明确确认后才能安装。

## 工程兼容性

效果被放到时间线上或被 AI 动效匹配选中时，BVideo 会在工程（schema v18）中保存视觉配方和音效触发快照；场景背景保存为独立 `SceneClip` 的背景快照。因此更新或卸载来源包不会影响已有工程；快照始终可用于预览与导出。程序化叠层（图表、下划线扫线）在导出时由同一份快照栅格化为确定性的帧序列。
