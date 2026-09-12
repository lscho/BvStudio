# 音效分类与 Pro 可用性约束

本文档约束「音效」模块（资源面板 → 音效）中每个 Shotcraft 音频对免费用户的开放范围，与会员体系（见 `docs/17-会员授权服务协议.md`）配合。

## 1. 规则

| 分类 | 免费额度 | 超出部分 |
| --- | --- | --- |
| 常规分类（转场、冲击、交互、文字、氛围、数据、质感、相机） | 分类内**前 5 个**音效免费 | 第 6 个及之后的音效保留在原分类，但需要 Pro |
| 音乐 | 分类内**前 2 首**免费 | 第 3 首及之后的曲目需要 Pro |

- 顺序以音频目录（`SHOTCRAFT_AUDIO`）自身顺序为准；搜索与分类筛选不会改变某个音效的免费/Pro 档位。
- 档位按**展示分类**计算，不按原始分类：归并进同一展示分类的原始分类共用同一份 5 个免费名额。
- Pro 状态以设备授权为准：`isVipActive(useLicenseStore.status)` 为真时解锁全部音效与音乐。

## 2. 展示分类与原始分类映射

音频目录里的原始分类继续保留（AI 编排、哈希校验和素材路径都依赖它），资源面板按下面的映射归并展示：

| 展示分类 | 原始分类 | 数量 |
| --- | --- | --- |
| 转场 | transition、riser | 24 |
| 冲击 | impact、mech、glass | 26 |
| 交互 | ui、counter | 22 |
| 文字 | text、paper | 23 |
| 氛围 | light、scifi、crowd | 18 |
| 数据 | data | 13 |
| 质感 | film、fluid | 13 |
| 相机 | camera | 10 |
| 音乐 | bgm | 5 |

合计 149 条音效 + 5 首音乐。未登记的原始分类兜底归入「氛围」，避免新增素材时出现空白分类。

## 3. 界面行为

- 资源面板支持对 149 个音效与 5 首音乐进行搜索、试听和添加。
- 所有音效都可以试听，包括需要 Pro 的音效；试听不写入工程，也不消耗授权。
- 需要 Pro 的条目把右侧的添加按钮替换为文字 `PRO` 按钮，`title` 说明原因，点击进入「设置 → 会员与授权」。
- 锁定条目的名称降低不透明度作为辅助线索；锁定状态不依赖颜色单独表达。

## 4. 实现位置

| 位置 | 职责 |
| --- | --- |
| `src/domain/soundAccess.ts` | 展示分类顺序、原始分类映射、免费额度、档位计算（`soundTierMap` / `soundTier` / `canUseSound`） |
| `src/domain/shotcraftLibrary/audioCatalog.json` | 音频目录与原始分类；`id`、`file`、`sha256` 不随展示分类变化 |
| `src/components/ShotcraftAudioLibrary.tsx` | 按展示分类分组，按档位渲染 `PRO` 按钮；锁定条目的试听保持可用 |
| `src/components/AssetPanel.tsx` | 传入 `isPro` 与 `onNeedLicense` |
| `src/services/shotcraftAudio.ts`、`src/services/ai/provider.ts`、`src/services/ai/shotcraft.ts` | 过滤独立音效匹配、字幕分镜、AI 镜头的动作音效与内置音乐，并在生成、应用阶段校验权限 |
| `src/stores/licenseStore.ts`、`src/services/license.ts` | Pro 状态来源与离线宽限期 |

AI 镜头、字幕分镜和独立字幕音效匹配只会收到当前身份可用且允许自动选择的新版音效；内置音乐选择器也隐藏无权限曲目。应用已生成的预览或匹配结果时会再次读取授权状态，避免过期 Pro 结果继续写入工程。旧版 9 个内置合成音效不再用于新建内容，只保留旧工程恢复兼容。

## 5. 维护约定

- 新增音效时按原始分类加入目录末尾：常规分类第 6 个之后自动成为 Pro；音乐分类第 3 首之后自动成为 Pro。
- 调整免费额度：常规分类改 `FREE_SOUNDS_PER_CATEGORY`，音乐改 `FREE_MUSIC_TRACKS`；变化会立即影响对应分类，必须在发布说明中标注。
- 新增原始分类时必须同步更新 `SOUND_CATEGORY_BY_SOURCE` 与本文档第 2 节映射，并保证 `src/domain/soundAccess.test.ts` 通过。
- 不要用分类之外的状态（如搜索词、是否已加载）影响档位，否则同一音效会出现免费与 Pro 两种状态。
