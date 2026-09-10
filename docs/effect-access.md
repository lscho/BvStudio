# 动效分类与 Pro 可用性约束

本文档约束「动效展示」模块（资源面板 → 动效）中每个动效对免费用户的开放范围，与会员体系（见 `docs/license-api.md`）配合。

## 1. 规则

| 分类 | 免费额度 | 超出部分 |
| --- | --- | --- |
| 常规分类（背景、场景、标题、强调、卡片、标注、数据、布局） | 分类内**前 10 个**动效免费 | 第 11 个及之后的动效留在原分类，但需要 Pro |
| 展示 | 分类内**前 10 个**动效免费 | 其余动效整体并入「高级」分类 |
| 高级 | 无 | 分类内**全部**动效需要 Pro |

- 顺序以动效库自身顺序为准（`BUILTIN_EFFECTS` 的构造顺序），与分类展示顺序一致。
- 搜索、筛选、已安装的扩展动效包都不会改变某个动效的免费/Pro 档位。
- 未收录在内置库中的动效（用户自行安装的 `.bveffect` 包）默认免费；只有其分类明确为「高级」时才按 Pro 处理。
- Pro 状态以设备授权为准：`isVipActive(useLicenseStore.status)` 为真时解锁全部动效。

## 2. 分类归属

- 「展示」是**提升分类**（`PROMOTED_EFFECT_CATEGORIES`）：构造 `BUILTIN_EFFECTS` 时只保留免费额度内的 10 个动效，第 11 个起整体改写为「高级」。因此展示分类下不会出现锁定条目。
- 布局与数据动效数量超过 10 个，但不在提升分类里：第 11 个起仍留在原分类，显示为锁定状态。
- 高级分类因此包含两类动效：显式登记的 3D/运镜动效，以及从展示分类提升进来的进阶动效。

## 3. 高级分类的显式清单

`PREMIUM_EFFECT_IDS` 收录**3D 空间与复杂运镜**类动效，判定口径：

- 依赖 three/canvas 渲染或真实 3D 空间关系（海报墙、双图、环形画廊、立方体、共享元素归位）；
- 需要相机机位、景深、透视或速度曲线等镜头语言（推拉、俯冲、环绕、变速、爆炸分层）。

当前清单（共 23 个）：

```
terminal-3d, poster-wall-3d, image-duet-3d,
shotcraft-basic-3d, shotcraft-carousel3-d, shotcraft-cube-navigation, shotcraft-cube-rotate,
shotcraft-shared-element-morph, shotcraft-crash-impact-real, shotcraft-crash-zoom-real,
shotcraft-dolly-zoom-real, shotcraft-multiplane-real, shotcraft-graze-face-tour,
shotcraft-overhead-tabletop-drop, shotcraft-tilt-reveal, shotcraft-drone-dive-landing,
shotcraft-exploded-view, shotcraft-steep-tilt-glide, shotcraft-bullet-time-freeze-orbit,
shotcraft-dutch-roll-to-level, shotcraft-pull-back-isolation, shotcraft-slow-push-in,
shotcraft-terminal3-d
```

## 4. 界面行为

- 所有动效都可以在画布中预览，包括需要 Pro 的动效；预览不写入工程，也不消耗授权。
- 需要 Pro 的条目把右侧的添加按钮替换为文字 `PRO` 按钮，`title` 说明原因，点击进入「设置 → 会员与授权」。
- 缩略图在锁定时降低不透明度作为辅助线索；锁定状态不依赖颜色单独表达。

## 5. 实现位置

| 位置 | 职责 |
| --- | --- |
| `src/domain/effectAccess.ts` | 免费额度、分类顺序、档位计算（`effectTierMap` / `effectTier` / `canUseEffect`） |
| `src/domain/effects.ts` | `EffectCategory` 增加「高级」；`PROMOTED_EFFECT_CATEGORIES` 与 `PREMIUM_EFFECT_IDS` 决定分类归属 |
| `src/components/AssetPanel.tsx` | 按档位渲染 `PRO` 按钮；锁定条目的预览保持可用，添加改为引导会员授权 |
| `src/services/ai/provider.ts`、`src/services/ai/shotcraft.ts` | 按当前身份过滤 AI 动效与镜头候选，并校验模型结果 |
| `src/stores/licenseStore.ts`、`src/services/license.ts` | Pro 状态来源与离线宽限期 |

AI 编排采用两道检查：请求阶段只把当前身份可用的 ID 写入提示词和结构化输出范围；用户应用预览时重新读取授权状态，防止授权过期或身份切换后写入 Pro 内容。

## 6. 维护约定

- 新增内置动效时默认落在原分类末尾：常规分类第 11 个之后自动成为 Pro；提升分类新增的动效会自动并入高级分类。
- 新增或移除高级清单动效必须同时更新 `PREMIUM_EFFECT_IDS` 与本文档第 3 节清单，并保证 `src/domain/effectAccess.test.ts` 通过。
- 调整免费额度只需修改 `FREE_EFFECTS_PER_CATEGORY`；该值变化会立即影响所有常规分类，必须在发布说明中标注。
- 不要把动效加入 `PROMOTED_EFFECT_CATEGORIES` 之外的新分类来规避规则；不要用分类之外的状态（如搜索词、是否已安装动效包）影响档位，否则同一动效会出现免费与 Pro 两种状态。
