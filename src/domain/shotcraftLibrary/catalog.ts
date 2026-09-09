// Adapted from video-shotcraft, Copyright 2026 Wei Yihao, Apache-2.0.
// BVideo adaptation: editable copy/assets and deterministic native frame context.
import type { CompositionSlot } from "@/domain/compositions";
export interface LibraryShot { id: string; card: string; style: string; name: string; category: string; description: string; intention: string; use: string; frames: number; holdFrame: number; texts: { key: string; label: string; default: string }[]; imageKeys: string[]; slots: CompositionSlot[] }
export const SHOTCRAFT_LIBRARY: readonly LibraryShot[] = [
  {
    "id": "shotcraft-crash-impact-real",
    "card": "crash-zoom-punch",
    "style": "CrashImpactReal",
    "name": "冲撞变焦 · CrashImpactReal",
    "category": "camera",
    "description": "全景一拍急推到目标特写（6f），落位二选一——过冲回弹（弹性）或撞停震屏（重量）",
    "intention": "慢推近（spotlight-hero-card）是\"请看\"，急推是\"看这个！\"——一拍之内 从全景砸到特写，视线没有选择余地。落位质感分两款：回弹是弹性 （\"看这个\"），撞停震屏是重量（\"就是它\"），按强调级选。",
    "use": "功能段\"点名\"镜头——把观众视线一拍按到目标卡/模块上；强调级用撞停",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-crash-zoom-real",
    "card": "crash-zoom-punch",
    "style": "CrashZoomReal",
    "name": "冲撞变焦 · CrashZoomReal",
    "category": "camera",
    "description": "全景一拍急推到目标特写（6f），落位二选一——过冲回弹（弹性）或撞停震屏（重量）",
    "intention": "慢推近（spotlight-hero-card）是\"请看\"，急推是\"看这个！\"——一拍之内 从全景砸到特写，视线没有选择余地。落位质感分两款：回弹是弹性 （\"看这个\"），撞停震屏是重量（\"就是它\"），按强调级选。",
    "use": "功能段\"点名\"镜头——把观众视线一拍按到目标卡/模块上；强调级用撞停",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-dolly-zoom-real",
    "card": "depth-layer-moves",
    "style": "DollyZoomReal",
    "name": "分层深度运镜 · DollyZoomReal",
    "category": "camera",
    "description": "分层深度两款运镜——多层视差滑轨（3 层速度梯度横移出纵深）与伪 dolly-zoom（主体钉死、背景膨胀压来）",
    "intention": "整页平移是\"看页面\"，分层深度是\"在页面的空间里\"。视差滑轨给横移 加纵深（迪士尼多平面摄影机原理，Linear 片同款质感）；伪 dolly-zoom 反过来——主角纹丝不动、全世界压过来，给戏剧性时刻蓄力。",
    "use": "平面截图要\"有厚度\"的段落；戏剧性蓄力时刻用 dolly-zoom（一支片 ≤1 次）",
    "frames": 135,
    "holdFrame": 134,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-multiplane-real",
    "card": "depth-layer-moves",
    "style": "MultiplaneReal",
    "name": "分层深度运镜 · MultiplaneReal",
    "category": "camera",
    "description": "分层深度两款运镜——多层视差滑轨（3 层速度梯度横移出纵深）与伪 dolly-zoom（主体钉死、背景膨胀压来）",
    "intention": "整页平移是\"看页面\"，分层深度是\"在页面的空间里\"。视差滑轨给横移 加纵深（迪士尼多平面摄影机原理，Linear 片同款质感）；伪 dolly-zoom 反过来——主角纹丝不动、全世界压过来，给戏剧性时刻蓄力。",
    "use": "平面截图要\"有厚度\"的段落；戏剧性蓄力时刻用 dolly-zoom（一支片 ≤1 次）",
    "frames": 135,
    "holdFrame": 134,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/float-search.png",
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-graze-face-tour",
    "card": "graze-face-tour",
    "style": "graze-face-tour",
    "name": "贴面游走",
    "category": "camera",
    "description": "大倾角贴面游走特写——镜头贴着 UI 表面低飞掠过（侧栏树/顶栏/列表当地形），页面文字初始悬浮在界面上空带同形软影，随镜头行进先后加速贴落回界面",
    "intention": "把 UI 拍成地形：大倾角特写让侧栏树、导航、列表行变成掠过的地貌， 浅景深强化\"贴面\"。戏眼是**文字空中贴落**：文字/组件不是原地淡入， 而是悬浮在界面上空（3D z 轴抬高），在空中时往界面投同形软影， 随镜头行进先后加速贴落、影子随高度收敛消失——观众看见界面在 镜头经过时\"完成自己\"。影子是可感命门：没有影子，悬浮读作 普通位移入场；有影子，空间关系瞬间成立。",
    "use": "功能区巡礼（把 UI 当地景飞掠）；配合暗场+霓虹缘光做产品\"内部世界\"段落；界面内容逐区登场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SPACES"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Recent"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Favorites"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Logo"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Split.io Access for Oleg"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Todo"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Comments"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Done"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "≡ List"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "▦ Gallery"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "ClickUp"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "Home"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "3"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "Search by app, filetype…"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "Delegated"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "Filter"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "Group"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "Sort"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "TODAY"
      },
      {
        "key": "copy19",
        "label": "文字 20",
        "default": "TASK NAME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-overhead-tabletop-drop",
    "card": "overhead-camera-moves",
    "style": "overhead-tabletop-drop",
    "name": "俯视桌面扎落",
    "category": "camera",
    "description": "俯拍揭示两式——tilt-reveal 俯仰抬正揭示、overhead-tabletop-drop 桌面卡阵横滑骤降扎入",
    "intention": "库内俯拍视角一直空缺——crane-rise 是\"平移+缩放\"的升起（俯仰角 不动），space-camera C 式 drone-dive 是俯冲降落一镜到底；这两式让 **俯仰角本身讲故事**：A 是揭示——整页 rotateX 平躺、开场只见上缘 一条透视窄带，机位\"抬头\"回正，内容一排排涌入视野，像掀开桌上的 图纸；B 是选择——三张页面卡平躺成桌面卡阵，相机俯拍横向滑过依次 掠过（韦斯·安德森 tabletop），滑到目标页猛地俯冲扎入、抬正成满屏， \"巡视一圈，就选这张\"。选型：单页开场用 A，多页转场/开场用 B。",
    "use": "用\"俯仰角\"讲故事的开场/转场：单页 establishing 用 A，多页巡视择一扎入用 B",
    "frames": 145,
    "holdFrame": 144,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-tilt-reveal",
    "card": "overhead-camera-moves",
    "style": "tilt-reveal",
    "name": "俯仰揭示",
    "category": "camera",
    "description": "俯拍揭示两式——tilt-reveal 俯仰抬正揭示、overhead-tabletop-drop 桌面卡阵横滑骤降扎入",
    "intention": "库内俯拍视角一直空缺——crane-rise 是\"平移+缩放\"的升起（俯仰角 不动），space-camera C 式 drone-dive 是俯冲降落一镜到底；这两式让 **俯仰角本身讲故事**：A 是揭示——整页 rotateX 平躺、开场只见上缘 一条透视窄带，机位\"抬头\"回正，内容一排排涌入视野，像掀开桌上的 图纸；B 是选择——三张页面卡平躺成桌面卡阵，相机俯拍横向滑过依次 掠过（韦斯·安德森 tabletop），滑到目标页猛地俯冲扎入、抬正成满屏， \"巡视一圈，就选这张\"。选型：单页开场用 A，多页转场/开场用 B。",
    "use": "用\"俯仰角\"讲故事的开场/转场：单页 establishing 用 A，多页巡视择一扎入用 B",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-drone-dive-landing",
    "card": "space-camera-moves",
    "style": "drone-dive-landing",
    "name": "无人机俯冲落点",
    "category": "camera",
    "description": "3D 空间化运镜两式——exploded-view 爆炸分解（构件沿 Z 炸开再合体）、drone-dive-landing 无人机俯冲降落",
    "intention": "depth-layer 卡是给平移加纵深——层在动、页面还是页面。这两式更进一步： 整页被当成一个 3D 实体，相机（或世界）绕着它做实拍级机动。两式叙事 语义各占一格：A 说\"看看它由什么组成\"（拆解展示，Apple 发布片语言）； C 说\"从全局俯瞰砸到主角\"（上帝视角一头扎进 hero 特写，全景→焦点）。",
    "use": "把平面页面当 3D 实体拍的高光段落；两式都是\"大动作\"，一支片合计 ≤2 次",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-exploded-view",
    "card": "space-camera-moves",
    "style": "exploded-view",
    "name": "爆炸分层视图",
    "category": "camera",
    "description": "3D 空间化运镜两式——exploded-view 爆炸分解（构件沿 Z 炸开再合体）、drone-dive-landing 无人机俯冲降落",
    "intention": "depth-layer 卡是给平移加纵深——层在动、页面还是页面。这两式更进一步： 整页被当成一个 3D 实体，相机（或世界）绕着它做实拍级机动。两式叙事 语义各占一格：A 说\"看看它由什么组成\"（拆解展示，Apple 发布片语言）； C 说\"从全局俯瞰砸到主角\"（上帝视角一头扎进 hero 特写，全景→焦点）。",
    "use": "把平面页面当 3D 实体拍的高光段落；两式都是\"大动作\"，一支片合计 ≤2 次",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-steep-tilt-glide",
    "card": "steep-tilt-glide",
    "style": "steep-tilt-glide",
    "name": "侧立透视滑行",
    "category": "camera",
    "description": "固定镜头下直立页面以 60° 强透视侧立（右近左远），页面自身沿其 3D 横面方向滑移掠过镜头（物动镜不动），滑移带速度重影、文字组件悬空贴落、由暗揭亮",
    "intention": "把页面立成一堵斜墙：镜头钉死不动，60° 强透视让右缘贴脸、左缘 消失在灭点，页面自己沿自身平面横向滑移——内容像列车车厢一样 依次掠过。命门是**物动镜不动**：perspective/origin/rotY 全程常数， 唯一动的量是页面局部 translateX——镜头一动语义就变成运镜炫技， 这里的戏是\"页面在自我展示\"。角度经三轮收敛为精确 60° （-45°\"不对\"→-53°\"再大一点\"→-60°选中）。",
    "use": "长页面/多区块 UI 的炫技巡览（内容依次滑过固定机位）；暗场霓虹调性；与贴面运镜卡互补的\"侧掠\"机位",
    "frames": 120,
    "holdFrame": 119,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Product analytics"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "ClickUp 3.0"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "ClickUp"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Home"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Inbox"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "W"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Product Management"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "List"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Board"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "11"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "IN PROGRESS"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "TASK NAME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-bullet-time-freeze-orbit",
    "card": "tension-camera-moves",
    "style": "bullet-time-freeze-orbit",
    "name": "冻结环绕",
    "category": "camera",
    "description": "情绪运镜四式——bullet-time 冻结环绕、dutch-roll 斜角滚正、slow-push 慢推压迫、pull-back 拉远孤立，相机替观众\"感受\"而非\"看\"",
    "intention": "space-camera-moves 三式是\"把页面当 3D 实体拍\"的高光炫技；这四式相反—— 动作本身克制，全部劲道在情绪语义上：A 说\"这一刻值得停下时间看\" （运动中的元素被冻住、相机绕行审视）；B 说\"问题解决了，世界被扶正\" （斜角悬着的难受感在节拍上滚回水平）；C 说\"有什么要发生了\"（慢到 不自觉的推近积压张力，顶点硬切释放）；D 说\"最后只剩这一件事\" （后拉中周围逐层熄灭，孤悬一点收束全片）。四式各占一个情绪格， 是分镜阶段\"这一段观众该感到什么\"的直接词汇。",
    "use": "情绪节点（震撼/纠偏/积压/收束）的运镜语言；与 space-camera-moves 的\"炫技大动作\"互补——这四式动作小、情绪重",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BULLET TIME"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FREEZE"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-dutch-roll-to-level",
    "card": "tension-camera-moves",
    "style": "dutch-roll-to-level",
    "name": "斜角滚正",
    "category": "camera",
    "description": "情绪运镜四式——bullet-time 冻结环绕、dutch-roll 斜角滚正、slow-push 慢推压迫、pull-back 拉远孤立，相机替观众\"感受\"而非\"看\"",
    "intention": "space-camera-moves 三式是\"把页面当 3D 实体拍\"的高光炫技；这四式相反—— 动作本身克制，全部劲道在情绪语义上：A 说\"这一刻值得停下时间看\" （运动中的元素被冻住、相机绕行审视）；B 说\"问题解决了，世界被扶正\" （斜角悬着的难受感在节拍上滚回水平）；C 说\"有什么要发生了\"（慢到 不自觉的推近积压张力，顶点硬切释放）；D 说\"最后只剩这一件事\" （后拉中周围逐层熄灭，孤悬一点收束全片）。四式各占一个情绪格， 是分镜阶段\"这一段观众该感到什么\"的直接词汇。",
    "use": "情绪节点（震撼/纠偏/积压/收束）的运镜语言；与 space-camera-moves 的\"炫技大动作\"互补——这四式动作小、情绪重",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-pull-back-isolation",
    "card": "tension-camera-moves",
    "style": "pull-back-isolation",
    "name": "拉远孤立",
    "category": "camera",
    "description": "情绪运镜四式——bullet-time 冻结环绕、dutch-roll 斜角滚正、slow-push 慢推压迫、pull-back 拉远孤立，相机替观众\"感受\"而非\"看\"",
    "intention": "space-camera-moves 三式是\"把页面当 3D 实体拍\"的高光炫技；这四式相反—— 动作本身克制，全部劲道在情绪语义上：A 说\"这一刻值得停下时间看\" （运动中的元素被冻住、相机绕行审视）；B 说\"问题解决了，世界被扶正\" （斜角悬着的难受感在节拍上滚回水平）；C 说\"有什么要发生了\"（慢到 不自觉的推近积压张力，顶点硬切释放）；D 说\"最后只剩这一件事\" （后拉中周围逐层熄灭，孤悬一点收束全片）。四式各占一个情绪格， 是分镜阶段\"这一段观众该感到什么\"的直接词汇。",
    "use": "情绪节点（震撼/纠偏/积压/收束）的运镜语言；与 space-camera-moves 的\"炫技大动作\"互补——这四式动作小、情绪重",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "99.9%"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-slow-push-in",
    "card": "tension-camera-moves",
    "style": "slow-push-in",
    "name": "慢推压迫",
    "category": "camera",
    "description": "情绪运镜四式——bullet-time 冻结环绕、dutch-roll 斜角滚正、slow-push 慢推压迫、pull-back 拉远孤立，相机替观众\"感受\"而非\"看\"",
    "intention": "space-camera-moves 三式是\"把页面当 3D 实体拍\"的高光炫技；这四式相反—— 动作本身克制，全部劲道在情绪语义上：A 说\"这一刻值得停下时间看\" （运动中的元素被冻住、相机绕行审视）；B 说\"问题解决了，世界被扶正\" （斜角悬着的难受感在节拍上滚回水平）；C 说\"有什么要发生了\"（慢到 不自觉的推近积压张力，顶点硬切释放）；D 说\"最后只剩这一件事\" （后拉中周围逐层熄灭，孤悬一点收束全片）。四式各占一个情绪格， 是分镜阶段\"这一段观众该感到什么\"的直接词汇。",
    "use": "情绪节点（震撼/纠偏/积压/收束）的运镜语言；与 space-camera-moves 的\"炫技大动作\"互补——这四式动作小、情绪重",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "10x"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FASTER THAN BASELINE"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-terminal3-d",
    "card": "terminal-3d",
    "style": "terminal-3d",
    "name": "终端空间飞行",
    "category": "camera",
    "description": "三个终端窗散布 3D 空间，相机窗间飞行、途中正弦拉远，每到一窗打字机敲命令、结果逐行滑出——命令执行的空间叙事流",
    "intention": "终端输出天生是\"平面滚动\"的反电影语言，这张卡把它空间化：每条命令占据空间中一个实体窗口，相机像穿过机房一样逐窗拜访。飞行途中的拉远让观众瞥见\"还有更多窗口\"——工作流的全貌感。",
    "use": "开发者产品的 CLI/工作流演示：把\"三步命令\"拍成三站空间旅程",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "~/workspace — zsh"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "dev server"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "logs"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-avatar-grid-radial-build-colorize",
    "card": "avatar-grid-radial-build-colorize",
    "style": "avatar-grid-radial-build-colorize",
    "name": "分环生长染色",
    "category": "data",
    "description": "8×7 小卡片网格由中心分环生长铺满（内容混合首字母/图标/图片占位），随后约 15% 的卡片随机时刻染红标异常，标题图例常驻中央",
    "intention": "两幕结构：第一幕\"群体成形\"——卡片从中心一环环长出，像镜头下的菌落生长；第二幕\"异常浮现\"——铺满后个别卡片陆续变红，观众的眼睛被迫扫描全场找红点。它把\"我们帮你盯着所有项\"这句话拍成了体验。",
    "use": "\"群体中浮现异常/重点\"的数据叙事：用户群健康度、监控面板、批量状态总览",
    "frames": 168,
    "holdFrame": 167,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Let's bring them back in"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-axis-rescale-shock-v2",
    "card": "chart-live-moves",
    "style": "AxisRescaleShockV2",
    "name": "活体图表 · AxisRescaleShockV2",
    "category": "data",
    "description": "活体图表三式——oscilloscope-stream 示波流线（曲线右端实时写入+突发尖峰）、unit-dot-swarm-regroup 点阵重组（点群三幕迁徙聚成数字）、axis-rescale-shock 轴爆表重标（新值冲出画框逼 y 轴重标）",
    "intention": "图表不是插图是剧情。三式共同前提（实测判例）：**必须真图表语境** ——真轴标/真数据/真文案，灰阶占位条测不出数据叙事的表达力。 A 示波流线：曲线写入点钉在右端上下起伏，旧数据左流出画，中途一次 突发尖峰（振幅 2.2×、读数跳大变强调色）——\"实时\"不用说出口，还有事件； B 点阵重组：320 个点（每点≈40 customers）散布→聚三簇（浮 Free/Pro/ Enterprise 真标签）→列队成柱（真轴标）→聚成点阵大数字 \"12,847\"—— 同一批点，观众能跟着某一颗看它归队； C 轴爆表：折线正常爬升，新值顶破图表上沿冲出卡片 220px（强调色粗线 插进标题区），停半拍，y 轴\"哗\"地重标（旧刻度飞出/新刻度滑入/网格 加密/旧线压扁成地平线），新值落回+弹真值标签——用\"坐标轴装不下\"演增长。",
    "use": "数据叙事段落；分别讲\"实时性\"、\"每个数字是一个人\"、\"增长装不下\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "AXIS RESCALE SHOCK V2"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Monthly revenue"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "FY2026 · all products · USD"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "$0"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "$340k"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-oscilloscope-stream-v2",
    "card": "chart-live-moves",
    "style": "OscilloscopeStreamV2",
    "name": "活体图表 · OscilloscopeStreamV2",
    "category": "data",
    "description": "活体图表三式——oscilloscope-stream 示波流线（曲线右端实时写入+突发尖峰）、unit-dot-swarm-regroup 点阵重组（点群三幕迁徙聚成数字）、axis-rescale-shock 轴爆表重标（新值冲出画框逼 y 轴重标）",
    "intention": "图表不是插图是剧情。三式共同前提（实测判例）：**必须真图表语境** ——真轴标/真数据/真文案，灰阶占位条测不出数据叙事的表达力。 A 示波流线：曲线写入点钉在右端上下起伏，旧数据左流出画，中途一次 突发尖峰（振幅 2.2×、读数跳大变强调色）——\"实时\"不用说出口，还有事件； B 点阵重组：320 个点（每点≈40 customers）散布→聚三簇（浮 Free/Pro/ Enterprise 真标签）→列队成柱（真轴标）→聚成点阵大数字 \"12,847\"—— 同一批点，观众能跟着某一颗看它归队； C 轴爆表：折线正常爬升，新值顶破图表上沿冲出卡片 220px（强调色粗线 插进标题区），停半拍，y 轴\"哗\"地重标（旧刻度飞出/新刻度滑入/网格 加密/旧线压扁成地平线），新值落回+弹真值标签——用\"坐标轴装不下\"演增长。",
    "use": "数据叙事段落；分别讲\"实时性\"、\"每个数字是一个人\"、\"增长装不下\"",
    "frames": 112,
    "holdFrame": 111,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "OSCILLOSCOPE STREAM V2"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Requests per second"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "api-gateway · production · last 60 s"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "req/s · live"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-unit-dot-swarm-regroup-v2",
    "card": "chart-live-moves",
    "style": "UnitDotSwarmRegroupV2",
    "name": "活体图表 · UnitDotSwarmRegroupV2",
    "category": "data",
    "description": "活体图表三式——oscilloscope-stream 示波流线（曲线右端实时写入+突发尖峰）、unit-dot-swarm-regroup 点阵重组（点群三幕迁徙聚成数字）、axis-rescale-shock 轴爆表重标（新值冲出画框逼 y 轴重标）",
    "intention": "图表不是插图是剧情。三式共同前提（实测判例）：**必须真图表语境** ——真轴标/真数据/真文案，灰阶占位条测不出数据叙事的表达力。 A 示波流线：曲线写入点钉在右端上下起伏，旧数据左流出画，中途一次 突发尖峰（振幅 2.2×、读数跳大变强调色）——\"实时\"不用说出口，还有事件； B 点阵重组：320 个点（每点≈40 customers）散布→聚三簇（浮 Free/Pro/ Enterprise 真标签）→列队成柱（真轴标）→聚成点阵大数字 \"12,847\"—— 同一批点，观众能跟着某一颗看它归队； C 轴爆表：折线正常爬升，新值顶破图表上沿冲出卡片 220px（强调色粗线 插进标题区），停半拍，y 轴\"哗\"地重标（旧刻度飞出/新刻度滑入/网格 加密/旧线压扁成地平线），新值落回+弹真值标签——用\"坐标轴装不下\"演增长。",
    "use": "数据叙事段落；分别讲\"实时性\"、\"每个数字是一个人\"、\"增长装不下\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "UNIT DOT SWARM REGROUP V2"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Each dot ≈ 40 customers"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Total customers"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-counter-confetti",
    "card": "counter-confetti",
    "style": "counter-confetti",
    "name": "数字冲刺纸屑",
    "category": "data",
    "description": "大数字 easeOutQuart 冲刺计数并带 scale 过冲，到位前一拍 52 片彩纸从两侧抛物线炸入，冲击环扩散、标签字距收紧收尾",
    "intention": "数字不是\"显示\"出来的，是\"冲线\"的：计数曲线前快后慢像百米冲刺进入慢镜，纸屑在数字到位**之前**抢拍爆开——庆祝比结果先到半拍，情绪压过信息，观众先兴奋再看清数字。",
    "use": "里程碑/成绩数字的庆祝拍：用户数、营收、下载量等\"值得开香槟\"的指标揭示",
    "frames": 138,
    "holdFrame": 137,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "METRIC THIS WEEK"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cycle-glass-node-morph",
    "card": "cycle-glass-node-morph",
    "style": "cycle-glass-node-morph",
    "name": "循环玻璃节点接管",
    "category": "data",
    "description": "单一主体在对角擦除中缩入机制图，三段循环标签沿弧线依次建立，连续推近时三枚玻璃节点从下方托起并接管原标签，最后诊断标记错峰钉住系统状态",
    "intention": "循环图最容易沦为“画三个圆加两支箭头”。本卡把机制解释建立在一个连续主体上： 主体不是被另一份灰阶副本替换，而是在对角擦除发生时同步缩入系统中心；循环文字先作为 黑色概念标签出现，推近后玻璃节点从它们下方升起，把同一标签转为白色节点标题。 观众因此读到的是**场景里的对象被解释成一套运行机制**，而不是切到另一页 PPT。",
    "use": "AI agent/自动化/控制系统的感知—推理—执行循环；“一个对象背后有三段机制”的解释镜头；从真实场景过渡到抽象系统图的技术型 B-roll",
    "frames": 257,
    "holdFrame": 256,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SENSE"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "MODEL"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "ACT"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "CONTEXT"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "SYSTEM LOOP"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "SUBJECT"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-needle-sweep-selftest",
    "card": "gauge-readout-moves",
    "style": "needle-sweep-selftest",
    "name": "满弧扫针自检",
    "category": "data",
    "description": "仪表读数两式——needle-sweep-selftest 满弧扫针（点火自检指针甩满全弧再回落真值）与 tape-scroll-fixed-pointer 滚带定针（针不动刻度带滚过+冲刺刹车）",
    "intention": "把\"报数值\"做成仪表的身体动作：A 是汽车点火自检——表盘指针先\"唰\"地 甩满全弧（270°）再回落定格真实值，多表错峰成波浪，先亮量程再报数， 开场宣誓感；B 是飞机空速带语法——指针/取景窗钉死画面正中，带刻度的 标尺整体从底下滚过，大数值跳变时刻度带 45px/f 冲刺、末尾 spring 刹车 带回摆过冲，\"世界动、针不动\"，数值大小变成看得见的位移距离。 与 odometer-digit-roll 分工：那是数字在窗里滚，B 是连刻度格线全在平移。",
    "use": "dashboard 开场仪式/性能指标揭晓；A 多表盘开机感，B 单指标大跳变",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "NEEDLE SWEEP SELF-TEST"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-tape-scroll-fixed-pointer",
    "card": "gauge-readout-moves",
    "style": "tape-scroll-fixed-pointer",
    "name": "滚带定针",
    "category": "data",
    "description": "仪表读数两式——needle-sweep-selftest 满弧扫针（点火自检指针甩满全弧再回落真值）与 tape-scroll-fixed-pointer 滚带定针（针不动刻度带滚过+冲刺刹车）",
    "intention": "把\"报数值\"做成仪表的身体动作：A 是汽车点火自检——表盘指针先\"唰\"地 甩满全弧（270°）再回落定格真实值，多表错峰成波浪，先亮量程再报数， 开场宣誓感；B 是飞机空速带语法——指针/取景窗钉死画面正中，带刻度的 标尺整体从底下滚过，大数值跳变时刻度带 45px/f 冲刺、末尾 spring 刹车 带回摆过冲，\"世界动、针不动\"，数值大小变成看得见的位移距离。 与 odometer-digit-roll 分工：那是数字在窗里滚，B 是连刻度格线全在平移。",
    "use": "dashboard 开场仪式/性能指标揭晓；A 多表盘开机感，B 单指标大跳变",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "TAPE SCROLL · FIXED POINTER"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-hatch-depth",
    "card": "hatch-depth",
    "style": "hatch-depth",
    "name": "斜纹变实柱",
    "category": "data",
    "description": "斜纹占位条逐条 wipe 伸长后，斜纹淡出、强调色实心层淡入并弹出数值，占位图蜕变为真数据条形图",
    "intention": "把\"占位符变成真数据\"这个产品瞬间拍成看得见的材质转换：先用 45° 斜纹条画出\"这里将有数据\"的草稿感，再让实心色层原位替换——几何完全不动、只换皮肤，观众读到的是\"同一样东西活了\"。",
    "use": "\"从草稿到真实数据\"的叙事拍；dashboard/报表功能引入，或强调数据实时性的段落",
    "frames": 132,
    "holdFrame": 131,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SERIES_A"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "SERIES_B"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "GROUP_C"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "GROUP_D"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "OTHER_E"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "K"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "METRICS"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "● LIVE"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "TOTAL 875K"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "AVG 1.02M"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-odometer-digit-roll",
    "card": "odometer-digit-roll",
    "style": "odometer-digit-roll",
    "name": "里程表数字滚动",
    "category": "data",
    "description": "里程表数字滚动大字报——全屏巨号指标每个数位像老虎机滚轮独立纵向滚动带残影，从左到右逐位过冲停稳，全部锁定瞬间整体加深脉冲",
    "intention": "王牌数字的登场库内有\"砸\"（score-slam）和\"弹\"（damage-number）， 都是位移系。本卡是**机械系**：数字不是飞进来的，是\"算出来的\"—— 每位一条 0–9 滚轮高速转动，从左到右逐位减速、过冲半格、咔哒锁定， Vercel Ship/Stripe Sessions 指标段的标准语法。滚动过程自带悬念 （它会停在几？），逐位锁定自带节奏（哒、哒、哒、哒），比直接显示 终值多一整拍的期待感。与 VerticalTicker（backlog 待选）的区别： 有终值、逐位停稳，不是无限滚动墙。",
    "use": "单个王牌指标的全屏亮相（\"10x\"/\"99.98%\"级）；与 impact-feedback B 式（伤害数字弹出）分工——那是元素级配菜，这是全屏级主菜",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "指标"
      },
      { "key": "copy1", "label": "数值（00.00）", "default": "00.00" },
      { "key": "copy2", "label": "单位", "default": "%" }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-confetti-crossfire",
    "card": "particle-celebrate-hits",
    "style": "confetti-crossfire",
    "name": "双侧礼炮",
    "category": "data",
    "description": "庆祝粒子两式——confetti-crossfire 双侧礼炮（里程碑揭晓帧双炮交叉彩屑弹幕）与 counter-tick-sparks 数字溅火（计数器每破整千顶部迸火星）",
    "intention": "给\"数字揭晓\"配可听感的视觉打点：A 是揭晓瞬间的句号——画面左下右下 两门炮同帧开火，上百颗翻转彩屑抛物线交叉飞过全屏再落出画外，纯庆祝 语义；B 是过程中的逗号——计数器每跳过一个整千，数字顶部\"叮\"地溅一撮 小火星坠落熄灭，终值那跳翻倍爆一大撮+数字弹 1.1x。两式都是闭式弹道 （初速+重力+衰减逐帧公式），免物理引擎、帧确定。",
    "use": "里程碑数字/KPI 揭晓/成就段落；A 一次性大庆祝，B 持续小打点",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CONFETTI CROSSFIRE"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "98.5%"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-counter-tick-sparks",
    "card": "particle-celebrate-hits",
    "style": "counter-tick-sparks",
    "name": "数字跳动溅火",
    "category": "data",
    "description": "庆祝粒子两式——confetti-crossfire 双侧礼炮（里程碑揭晓帧双炮交叉彩屑弹幕）与 counter-tick-sparks 数字溅火（计数器每破整千顶部迸火星）",
    "intention": "给\"数字揭晓\"配可听感的视觉打点：A 是揭晓瞬间的句号——画面左下右下 两门炮同帧开火，上百颗翻转彩屑抛物线交叉飞过全屏再落出画外，纯庆祝 语义；B 是过程中的逗号——计数器每跳过一个整千，数字顶部\"叮\"地溅一撮 小火星坠落熄灭，终值那跳翻倍爆一大撮+数字弹 1.1x。两式都是闭式弹道 （初速+重力+衰减逐帧公式），免物理引擎、帧确定。",
    "use": "里程碑数字/KPI 揭晓/成就段落；A 一次性大庆祝，B 持续小打点",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "COUNTER TICK SPARKS"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-particle-sand-fill",
    "card": "particle-sand-fill",
    "style": "particle-sand-fill",
    "name": "粒子落砂成柱",
    "category": "data",
    "description": "粒子落斗成柱——柱状图不长高而是\"下雨下出来\"：方点粒子逐颗坠落堆积成柱，堆满凝成实体+数值弹出",
    "intention": "把柱状图入场从\"长高动画\"换成\"落体堆积\"：每根柱上方下一场方块雨， 粒子逐颗坠落（重力加速）、触堆积面即停+15% 回弹，一层压一层堆到目标 高度后粒子面淡出换实体柱、顶部数值标签弹出。数据的\"量\"变成看得见的 \"一颗一颗攒出来\"——与 unit-dot-swarm-regroup（点群平面迁徙聚形） 分工：那是同一批点改队形，这是落体材料筑成图形。",
    "use": "柱状图/量级对比入场；讲\"积累/汇聚\"语义的数据段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "238"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "336"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "182"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "294"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "PARTICLE SAND FILL"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-ring-diagram-annotation-reveal",
    "card": "ring-diagram-annotation-reveal",
    "style": "ring-diagram-annotation-reveal",
    "name": "环图收束标注",
    "category": "data",
    "description": "全屏主体被圆形窗口收束成同心环图解，分段外环与 12 支向心箭头建立机制，整组随后左移缩小并为四块标题和两级注释让出右栏",
    "intention": "直接出现一张环形图，观众只会把它当作静态信息图。本卡先让主体占满全画面，再用 收缩的圆形窗口把“内容”压成一个可分析对象；细环、分段环与向心箭头依次补齐机制， 最后整组退到左侧，右栏才给出名称和解释。视觉顺序因此是**先经历对象，再理解结构， 最后阅读定义**，适合科技、工程、数据和概念科普。",
    "use": "把抽象名词解释成结构图；系统/装置/流程的“主体→机制→注释”镜头；需要先制造沉浸特写、再退成可读说明图的横屏 B-roll",
    "frames": 190,
    "holdFrame": 189,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CONTENT"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "SUBJECT"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "EXPLANATION"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "SUPPORTING DETAIL"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-brake-reticle-lock",
    "card": "scroll-brake-moves",
    "style": "brake-reticle-lock",
    "name": "刹停准星锁定",
    "category": "data",
    "description": "长卷急刹两式——changelog-scroll-brake 基本款（高速长卷指数减速精准停位+目标抬升）与 brake-reticle-lock 组合款（急刹帧同帧准星咬合）",
    "intention": "Linear changelog 视频语法：一整年的更新日志作为长卷高速掠过 （糊成色带），指数减速精准急刹停在本次发布那条上，该条抬升离面 高亮、其余退暗——密度感讲\"一直在发货\"，急停讲\"今天这条最大\"。 B 是组合变异：急刹帧**同帧**四个 L 角标从画外飞入咬合锁定停点 条目——急刹的\"哐\"与咬合的\"咔\"叠在同一帧共振（组合命门： 角标起跳帧=列表首停帧，错开退化成两招并置）。",
    "use": "changelog/发布史/长列表段落：\"一直在发货，今天这条最大\"；要给停点更强打击感用 B",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "v2.41"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-changelog-scroll-brake",
    "card": "scroll-brake-moves",
    "style": "changelog-scroll-brake",
    "name": "更新日志滚动刹停",
    "category": "data",
    "description": "长卷急刹两式——changelog-scroll-brake 基本款（高速长卷指数减速精准停位+目标抬升）与 brake-reticle-lock 组合款（急刹帧同帧准星咬合）",
    "intention": "Linear changelog 视频语法：一整年的更新日志作为长卷高速掠过 （糊成色带），指数减速精准急刹停在本次发布那条上，该条抬升离面 高亮、其余退暗——密度感讲\"一直在发货\"，急停讲\"今天这条最大\"。 B 是组合变异：急刹帧**同帧**四个 L 角标从画外飞入咬合锁定停点 条目——急刹的\"哐\"与咬合的\"咔\"叠在同一帧共振（组合命门： 角标起跳帧=列表首停帧，错开退化成两招并置）。",
    "use": "changelog/发布史/长列表段落：\"一直在发货，今天这条最大\"；要给停点更强打击感用 B",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-timeline-travel",
    "card": "timeline-travel",
    "style": "timeline-travel",
    "name": "时间线穿行",
    "category": "data",
    "description": "时间轴横移——镜头沿水平刻度轴加速掠过版本刻度，每过一格卡片弹立短停，末刻度急停推近",
    "intention": "把产品的版本史拍成一次沿时间轴的旅行（《反恐王国》片头判例）： 镜头缓起→冲刺→急刹三段变速横移，v1.0/v2.0/v3.0 刻度依次掠过， 每过一格对应卡片从刻度线上 spring 弹立——历史在窗外闪过， 急停在\"今天\"并推近。速度本身讲\"发展快\"，急停讲\"现在最重要\"。",
    "use": "changelog/里程碑/发展史段落（\"我们一直在发货\"的另一种拍法）；与 scroll-brake-moves 分工：那卡是纵向列表急刹，本卡是横向时间旅行",
    "frames": 104,
    "holdFrame": 103,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "v1.0"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "v2.0"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "v3.0"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Today"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "TIMELINE TRAVEL"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-assemble-then-type-flyin",
    "card": "assemble-then-type-flyin",
    "style": "assemble-then-type-flyin",
    "name": "骨架装配落字",
    "category": "effects",
    "description": "空的暗底网格上，无文字的组件骨架先从四面八方飞入贴合；随后各处文字逐字从 3D 空间旋转着飞来落位，先大标题后小标注，全部落位后页面成形",
    "intention": "把\"页面生成\"拆成两个语义清楚的阶段：先立骨架（框、卡片、分隔线、 色块，全部无字），再填文字。文字用逐字 3D 旋转落位，是因为骨架段 只有平面位移——两段的运动维度必须不同，否则观众读不出\"这是第二步\"。",
    "use": "页面/海报\"自己长出来\"的开场；排版类产品的能力展示；从骨架到成稿的两段式叙事",
    "frames": 156,
    "holdFrame": 155,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-aurora-bloom-bg-flip",
    "card": "aurora-bloom-bg-flip",
    "style": "aurora-bloom-bg-flip",
    "name": "极光升腾反黑",
    "category": "effects",
    "description": "浅灰底从底部升起紫橙柔焦 blob，随后整个底色在约 0.36s 内压暗到近黑、blob 压成余晖；文案同步 blur-out 换句 blur-in，换句间留空档不 cross-fade",
    "intention": "把\"底色反转\"当成重音符号用：前 62% 让极光慢慢升起、观众适应浅底， 然后用不到 0.4s 把整个画面压到近黑——这一下比任何缩放/闪白都更像 \"翻页\"。文案的换句必须卡在反转之后，且中间留空档，让观众先接住画面 变化再读新句。",
    "use": "叙事转折点（\"多年以来…→一切都变了\"）；品牌片从铺垫拉到重音的那一拍；深浅色系之间的段落切换",
    "frames": 156,
    "holdFrame": 155,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-brand-frame-snap",
    "card": "brand-frame-snap",
    "style": "brand-frame-snap",
    "name": "品牌画框硬切",
    "category": "effects",
    "description": "品牌色画框语法——一圈粗纯色画框先于内容长出包住全屏，录屏窗口落进框内；模式切换时整圈画框同帧硬翻色+窗内布局同帧换，一个 borderColor 干完章节导航/状态提示/品牌露出三件事",
    "intention": "真实录屏直接铺满屏没有品牌存在感，加 logo 水印又廉价。本卡用一圈 粗品牌色画框把录屏\"装裱\"起来：画框**先于内容出现**（先立画框再放 画，仪式感），之后画框颜色成为全片的语义编码——蓝=Design、绿=Dev Mode。章节切换时整圈画框一帧内硬翻色，无渐变，颜色硬切就是\"换挡\" 声效的视觉等价物；窗内布局同帧 A→B、角标与徽标同步换字，三处同帧 共振把\"模式切换\"砸实。与 theme-switch-moves 分工：那换的是 UI 本体 肤色（有扫过边界），本卡换的是\"画框\"这个包装层（同帧无边界）， 语义是模式/章节切换不是主题切换。",
    "use": "双模式/双章节产品片的全片包装层（蓝=模式A、绿=模式B 颜色编码）；真实录屏素材的品牌化包裹",
    "frames": 130,
    "holdFrame": 129,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-dashboard-glow-highlight-pill",
    "card": "dashboard-glow-highlight-pill",
    "style": "dashboard-glow-highlight-pill",
    "name": "金色胶囊指引",
    "category": "effects",
    "description": "金字悬于黑场，数据仪表盘自底带透视升入并持续 3D 漂移；金色光斑从右侧巡游到底部拉成胶囊，再由它起笔描出弹窗的辉光轮廓",
    "intention": "用一束光把观众的注意力从\"整个仪表盘\"收到\"这一个弹窗\"上。光斑先在 面板间巡游（宣布有东西要来），拉成胶囊（蓄力），再从胶囊落点起笔 描出弹窗轮廓（交棒）——三段是同一束光的连续变形，任何一处断开就 变成三个不相干的动画。全片仅 2s，每段都靠上一段的落点做起点。",
    "use": "金融/数据类产品的重功能揭示；\"注意这里\"的高级指引；黑金调品牌片的核心一拍",
    "frames": 60,
    "holdFrame": 59,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Ready."
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "◆ ACME"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Trade"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Earn"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Vault"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Support"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "0x8f...c2"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Connect"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Orderbook"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "Trades"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "155.01 ▼"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "● TOKEN-USD"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "PERP"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "155.01"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "24h Vol $1,891,145.10"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "Funding 0.0042%"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "OI $9.4M"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "Cross"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "10x"
      },
      {
        "key": "copy19",
        "label": "文字 20",
        "default": "One-Way"
      },
      {
        "key": "copy20",
        "label": "文字 21",
        "default": "Market"
      },
      {
        "key": "copy21",
        "label": "文字 22",
        "default": "Limit"
      },
      {
        "key": "copy22",
        "label": "文字 23",
        "default": "Pro"
      },
      {
        "key": "copy23",
        "label": "文字 24",
        "default": "▢ Reduce Only"
      },
      {
        "key": "copy24",
        "label": "文字 25",
        "default": "Buy"
      },
      {
        "key": "copy25",
        "label": "文字 26",
        "default": "Sell"
      },
      {
        "key": "copy26",
        "label": "文字 27",
        "default": "Account"
      },
      {
        "key": "copy27",
        "label": "文字 28",
        "default": "-USD"
      },
      {
        "key": "copy28",
        "label": "文字 29",
        "default": "152.30"
      },
      {
        "key": "copy29",
        "label": "文字 30",
        "default": "$7,801.75"
      },
      {
        "key": "copy30",
        "label": "文字 31",
        "default": "$1,775.00"
      },
      {
        "key": "copy31",
        "label": "文字 32",
        "default": "74,212.07"
      },
      {
        "key": "copy32",
        "label": "文字 33",
        "default": "$53,225.00"
      },
      {
        "key": "copy33",
        "label": "文字 34",
        "default": "Market | Limit"
      },
      {
        "key": "copy34",
        "label": "文字 35",
        "default": "Reverse"
      },
      {
        "key": "copy35",
        "label": "文字 36",
        "default": "Focus Mode"
      },
      {
        "key": "copy36",
        "label": "文字 37",
        "default": "All panels share one unified workspace layout. Changes in one panel are reflected in the others,"
      },
      {
        "key": "copy37",
        "label": "文字 38",
        "default": "keeping context in one place"
      },
      {
        "key": "copy38",
        "label": "文字 39",
        "default": "Choose how panels are arranged:"
      },
      {
        "key": "copy39",
        "label": "文字 40",
        "default": "● Standard"
      },
      {
        "key": "copy40",
        "label": "文字 41",
        "default": "Placeholder body copy for option one. The selected option directly determines the layout of each panel — simple and predictable."
      },
      {
        "key": "copy41",
        "label": "文字 42",
        "default": "○ Pro"
      },
      {
        "key": "copy42",
        "label": "文字 43",
        "default": "Placeholder body copy for option two, written a little longer so the block keeps its shape. Replace both with your own wording."
      },
      {
        "key": "copy43",
        "label": "文字 44",
        "default": "Confirm"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-line-unfold-panel",
    "card": "fui-hud-moves",
    "style": "line-unfold-panel",
    "name": "线条展开面板",
    "category": "effects",
    "description": "FUI/HUD 两式——line-unfold-panel 一线展面（线→面 CRT 语法）与 reticle-lock-on 准星咬合（取景框飞入锁定目标）",
    "intention": "科幻虚构界面（Jarvis/Territory）的两个可中性化母题。A 是面板的 仪式感开关机：1px 细线极快抽出→纵向撑开成面板→内容淡入，退场反向 压线缩点熄灭（老 CRT 关机）；灰阶细线即成立，不需要科技蓝。 B 是运动中的捕获：四个 L 形角标从画外冲入、超调回弹、\"咔\"地咬合 到目标元素四角+弹标签——与 freeze-annotate 分工：那卡冻结画面标注， 本卡在流动中点名。",
    "use": "暗场/科技感段落的面板入退场用 A；任何\"看这里\"的目标点名用 B（替代箭头圈红，画面不冻结）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "LINE UNFOLD PANEL"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-reticle-lock-on",
    "card": "fui-hud-moves",
    "style": "reticle-lock-on",
    "name": "准星锁定",
    "category": "effects",
    "description": "FUI/HUD 两式——line-unfold-panel 一线展面（线→面 CRT 语法）与 reticle-lock-on 准星咬合（取景框飞入锁定目标）",
    "intention": "科幻虚构界面（Jarvis/Territory）的两个可中性化母题。A 是面板的 仪式感开关机：1px 细线极快抽出→纵向撑开成面板→内容淡入，退场反向 压线缩点熄灭（老 CRT 关机）；灰阶细线即成立，不需要科技蓝。 B 是运动中的捕获：四个 L 形角标从画外冲入、超调回弹、\"咔\"地咬合 到目标元素四角+弹标签——与 freeze-annotate 分工：那卡冻结画面标注， 本卡在流动中点名。",
    "use": "暗场/科技感段落的面板入退场用 A；任何\"看这里\"的目标点名用 B（替代箭头圈红，画面不冻结）",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "TARGET · CARD_02"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-flyline-arc",
    "card": "glow-flyline-moves",
    "style": "flyline-arc",
    "name": "飞线连接",
    "category": "effects",
    "description": "暗场光斑与飞线三式——glow-orb-ambient 光斑底噪、flyline-arc 飞线连接、orb-flyline-relay 同帧共振组合",
    "intention": "这是库内第一张整卡住在**暗场**的卡。白底提亮不可见判例反过来读就是： 要玩光，先去暗场。A 是空间的呼吸——近黑底三团重 blur 光斑有机漂移， 中央深卡边缘随最近光斑靠近而泛光，背景不再是死的；B 是数据的动词—— 发光弧线从 A 卡\"打\"到 B 卡，亮点头领跑、渐隐光尾，落点描边脉冲点亮， 指标关联第一次有了方向；C 是 A+B 的焊接——飞线落点帧邻近光斑同帧 涨亮一拍，氛围层与事件层**同帧共振**，互相搭腔而非各演各的（组合命门： 拆开共振帧就退化成两张卡并置）。",
    "use": "全片唯一暗场段落的氛围与数据叙事：铺底噪用 A、讲数据流向用 B、要背景给前景搭腔用 C；Linear 官网味",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-glow-orb-ambient",
    "card": "glow-flyline-moves",
    "style": "glow-orb-ambient",
    "name": "暗场光斑呼吸",
    "category": "effects",
    "description": "暗场光斑与飞线三式——glow-orb-ambient 光斑底噪、flyline-arc 飞线连接、orb-flyline-relay 同帧共振组合",
    "intention": "这是库内第一张整卡住在**暗场**的卡。白底提亮不可见判例反过来读就是： 要玩光，先去暗场。A 是空间的呼吸——近黑底三团重 blur 光斑有机漂移， 中央深卡边缘随最近光斑靠近而泛光，背景不再是死的；B 是数据的动词—— 发光弧线从 A 卡\"打\"到 B 卡，亮点头领跑、渐隐光尾，落点描边脉冲点亮， 指标关联第一次有了方向；C 是 A+B 的焊接——飞线落点帧邻近光斑同帧 涨亮一拍，氛围层与事件层**同帧共振**，互相搭腔而非各演各的（组合命门： 拆开共振帧就退化成两张卡并置）。",
    "use": "全片唯一暗场段落的氛围与数据叙事：铺底噪用 A、讲数据流向用 B、要背景给前景搭腔用 C；Linear 官网味",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-orb-flyline-relay",
    "card": "glow-flyline-moves",
    "style": "orb-flyline-relay",
    "name": "光斑飞线接力",
    "category": "effects",
    "description": "暗场光斑与飞线三式——glow-orb-ambient 光斑底噪、flyline-arc 飞线连接、orb-flyline-relay 同帧共振组合",
    "intention": "这是库内第一张整卡住在**暗场**的卡。白底提亮不可见判例反过来读就是： 要玩光，先去暗场。A 是空间的呼吸——近黑底三团重 blur 光斑有机漂移， 中央深卡边缘随最近光斑靠近而泛光，背景不再是死的；B 是数据的动词—— 发光弧线从 A 卡\"打\"到 B 卡，亮点头领跑、渐隐光尾，落点描边脉冲点亮， 指标关联第一次有了方向；C 是 A+B 的焊接——飞线落点帧邻近光斑同帧 涨亮一拍，氛围层与事件层**同帧共振**，互相搭腔而非各演各的（组合命门： 拆开共振帧就退化成两张卡并置）。",
    "use": "全片唯一暗场段落的氛围与数据叙事：铺底噪用 A、讲数据流向用 B、要背景给前景搭腔用 C；Linear 官网味",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-attention-bounce",
    "card": "icon-performance-moves",
    "style": "attention-bounce",
    "name": "注意力弹跳",
    "category": "effects",
    "description": "图标表演两式——pop-burst-confirm 爆花确认（对勾蓄力弹大+炸粒子+扩散环）与 attention-bounce 求关注弹跳（图标连跳递增+落地压扁+镜头被吸引）",
    "intention": "库内图标动画品类首批入库：icon 是镜头怼着拍的表演者，不是 UI 角落的 微交互。A 是确认时刻的三连爆——大对勾先缩 0.6x 蓄力 3f、弹 1.35x 过冲 落回，同帧中心射出 10 根短线粒子+一圈描边环从边缘扩到 2.5 倍直径淡出， \"部署成功\"不是画出来的是炸出来的；B 是 macOS Dock 语汇——app 图标 原地连跳 4 次一次比一次高（0.5→1.2 倍 icon 高），每次落地压扁 （宽 1.2x 高 0.8x）+溅尘点，跳最高那下镜头向它轻推 8%（被吸引）， 落定后弹开功能面板——把\"用户注意力\"剪进叙事。",
    "use": "半屏级 icon 特写段落；A \"完成/成功\"的标点符号，B 新功能引出",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "New"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-pop-burst-confirm",
    "card": "icon-performance-moves",
    "style": "pop-burst-confirm",
    "name": "弹跳爆点确认",
    "category": "effects",
    "description": "图标表演两式——pop-burst-confirm 爆花确认（对勾蓄力弹大+炸粒子+扩散环）与 attention-bounce 求关注弹跳（图标连跳递增+落地压扁+镜头被吸引）",
    "intention": "库内图标动画品类首批入库：icon 是镜头怼着拍的表演者，不是 UI 角落的 微交互。A 是确认时刻的三连爆——大对勾先缩 0.6x 蓄力 3f、弹 1.35x 过冲 落回，同帧中心射出 10 根短线粒子+一圈描边环从边缘扩到 2.5 倍直径淡出， \"部署成功\"不是画出来的是炸出来的；B 是 macOS Dock 语汇——app 图标 原地连跳 4 次一次比一次高（0.5→1.2 倍 icon 高），每次落地压扁 （宽 1.2x 高 0.8x）+溅尘点，跳最高那下镜头向它轻推 8%（被吸引）， 落定后弹开功能面板——把\"用户注意力\"剪进叙事。",
    "use": "半屏级 icon 特写段落；A \"完成/成功\"的标点符号，B 新功能引出",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Deployed"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-anime-impact",
    "card": "impact-feedback",
    "style": "anime-impact",
    "name": "动漫打击帧",
    "category": "effects",
    "description": "命中反馈两式——hit-counter 连招计数（顿帧+伤害数字+combo 跳字）、anime-impact 动漫打击帧（负片+集中线+色散）",
    "intention": "元素砸到位却没有\"砸到了\"的一瞬，落位读作 PPT 飞入。游戏 juice （Vlambeer screenshake 理论）与动漫演出 impact frames 给了同一答案： 命中的那几帧把时间咬住，冲量才传到观众手上。两式是一条强度阶梯： B 用局部顿帧叠伤害数字和 combo 跳字，把功能清单剪成一套连招， 叙事感最强；C 是最重的一拳——撞停 3 帧翻负片炸集中线，强调级最高、 最风格化。",
    "use": "元素落位/撞击的\"命中一瞬\"——给砸入、撞停加游戏级手感；按强度阶梯选式",
    "frames": 120,
    "holdFrame": 119,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "IMPACT"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-hit-counter",
    "card": "impact-feedback",
    "style": "hit-counter",
    "name": "连招计数",
    "category": "effects",
    "description": "命中反馈两式——hit-counter 连招计数（顿帧+伤害数字+combo 跳字）、anime-impact 动漫打击帧（负片+集中线+色散）",
    "intention": "元素砸到位却没有\"砸到了\"的一瞬，落位读作 PPT 飞入。游戏 juice （Vlambeer screenshake 理论）与动漫演出 impact frames 给了同一答案： 命中的那几帧把时间咬住，冲量才传到观众手上。两式是一条强度阶梯： B 用局部顿帧叠伤害数字和 combo 跳字，把功能清单剪成一套连招， 叙事感最强；C 是最重的一拳——撞停 3 帧翻负片炸集中线，强调级最高、 最风格化。",
    "use": "元素落位/撞击的\"命中一瞬\"——给砸入、撞停加游戏级手感；按强度阶梯选式",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-halation-bloom",
    "card": "light-play-moves",
    "style": "halation-bloom",
    "name": "光晕绽放",
    "category": "effects",
    "description": "光效三式——spotlight-sweep 聚光扫字、sheen 单点扫光、halation-bloom 撞停晕染",
    "intention": "库内\"光\"一直只有 spotlight-hero-card 一个点射手法；这三式把光做成 体系，三种笔触三种职责：A 是**扫**——暗场里几乎不可见的标题被锥形 光摆动扫亮，光到哪哪亮，与 spotlight-hero-card 的区别是那个打卡片、 这个扫文字；B 是**擦**——深墨主角卡上一道 45° 高光带缓扫一次，被 圆角裁住，无声的加冕；D 是**晕**——白字撞停帧一圈柔晕猛涨炸开再 回落成驻留呼吸光，与 B 的区别是 B 移动扫过、D 驻留在高光边缘。 全部深底或深主角——**白底上提亮不可见**（判例）是这整张卡的地基。",
    "use": "把光当第四种笔触（扫/擦/晕）：暗场标题揭示（A）、主角卡加冕（B）、撞停帧冲击（D）",
    "frames": 145,
    "holdFrame": 144,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "10x"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "HALATION BLOOM"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-sheen-sweep-retry",
    "card": "light-play-moves",
    "style": "SheenSweepRetry",
    "name": "光影动效 · SheenSweepRetry",
    "category": "effects",
    "description": "光效三式——spotlight-sweep 聚光扫字、sheen 单点扫光、halation-bloom 撞停晕染",
    "intention": "库内\"光\"一直只有 spotlight-hero-card 一个点射手法；这三式把光做成 体系，三种笔触三种职责：A 是**扫**——暗场里几乎不可见的标题被锥形 光摆动扫亮，光到哪哪亮，与 spotlight-hero-card 的区别是那个打卡片、 这个扫文字；B 是**擦**——深墨主角卡上一道 45° 高光带缓扫一次，被 圆角裁住，无声的加冕；D 是**晕**——白字撞停帧一圈柔晕猛涨炸开再 回落成驻留呼吸光，与 B 的区别是 B 移动扫过、D 驻留在高光边缘。 全部深底或深主角——**白底上提亮不可见**（判例）是这整张卡的地基。",
    "use": "把光当第四种笔触（扫/擦/晕）：暗场标题揭示（A）、主角卡加冕（B）、撞停帧冲击（D）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "PRO"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-spotlight-sweep-reveal",
    "card": "light-play-moves",
    "style": "SpotlightSweepReveal",
    "name": "光影动效 · SpotlightSweepReveal",
    "category": "effects",
    "description": "光效三式——spotlight-sweep 聚光扫字、sheen 单点扫光、halation-bloom 撞停晕染",
    "intention": "库内\"光\"一直只有 spotlight-hero-card 一个点射手法；这三式把光做成 体系，三种笔触三种职责：A 是**扫**——暗场里几乎不可见的标题被锥形 光摆动扫亮，光到哪哪亮，与 spotlight-hero-card 的区别是那个打卡片、 这个扫文字；B 是**擦**——深墨主角卡上一道 45° 高光带缓扫一次，被 圆角裁住，无声的加冕；D 是**晕**——白字撞停帧一圈柔晕猛涨炸开再 回落成驻留呼吸光，与 B 的区别是 B 移动扫过、D 驻留在高光边缘。 全部深底或深主角——**白底上提亮不可见**（判例）是这整张卡的地基。",
    "use": "把光当第四种笔触（扫/擦/晕）：暗场标题揭示（A）、主角卡加冕（B）、撞停帧冲击（D）",
    "frames": 110,
    "holdFrame": 109,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SPOTLIGHT\nON"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-line-boil",
    "card": "line-boil",
    "style": "line-boil",
    "name": "线条沸腾",
    "category": "effects",
    "description": "线条沸腾——hold 期间文字/描边轮廓每 3 帧轻微扭动一次，像手绘逐帧重描，静止画面保持\"活着\"的呼吸感",
    "intention": "库内 R 系判例要求落定后\"真静止\"，但长字卡（3s+ 的黑场字卡、片尾） 完全冻结会读作\"片子卡了\"。本卡给第三种状态：**活着的静止**——轮廓 每 3 帧被\"重描\"一次，位置内容全然不动，只有线条边缘在极轻微地呼吸， 手绘动画 hold 帧的百年惯例。与 noise-drift（被否决）的区别正是可感性： 漂移是整体 1–3px 位移（肉眼读不出），沸腾是轮廓形变+阶梯跳变（每次 换 seed 都是一次可见的\"重描\"）。纸墨审美里这是\"手工感\"的直接来源。",
    "use": "标题字卡/描边元素的长 hold 段（黑场字卡升级首选）；质感层手法，寄生在别的镜头上",
    "frames": 105,
    "holdFrame": 104,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "LINE BOIL"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "ALIVE"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "boil on"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "boil off"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-radial-ripple-phone-chips",
    "card": "radial-ripple-phone-chips",
    "style": "radial-ripple-phone-chips",
    "name": "同心波纹手机",
    "category": "effects",
    "description": "浅灰底四层同心圆错相呼吸如水波，中央手机 mockup 屏内 feed 自动缓滚，两侧白色 chip 先后 spring pop 入场并悬浮",
    "intention": "用最少的动作把手机放在画面正中并让它\"活着\"：同心圆负责氛围呼吸， 屏内自动滚屏负责证明\"里面有内容在跑\"，两侧 chip 负责点出功能名。 三层动作各自极慢，叠起来才不会显得静止——这是产品定格镜头的标准配法。",
    "use": "移动端产品的\"这就是它\"定格镜头；功能点分列两侧的介绍段；片头/片尾的产品全景",
    "frames": 168,
    "holdFrame": 167,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Feature one"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Feature detail"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-riso-beat-pump",
    "card": "riso-print-hits",
    "style": "RisoBeatPump",
    "name": "孔版印刷冲击 · RisoBeatPump",
    "category": "effects",
    "description": "套印错位两式——riso-misregistration-hit 单发冲击帧（撞停裂双色版抖两下套准）与 riso-beat-pump 节拍泵（逐拍跳大+错版逐次加码）",
    "intention": "RGB 色散故障闪（impact-feedback C 式的一部分）是荧光屏语言，与纸墨 调性相克。这两式给出印刷版平替：元素裂成浅灰/深墨两份单色印版 （multiply 油墨感而非 screen 荧光感），像 risograph 没对准版，抖几下 \"啪\"地套准——同样的冲击力，介质想象完全换成纸上油墨。A 是单发： 撞停瞬间裂版、震荡衰减、硬切套准，给一次命中盖章；B 是它的节奏化： 每个鼓点整画面跳大 8% + 标题裂版，错位逐拍加码，越打越狠—— 卡点段的视觉低音鼓。同技术根（衰减震荡的双版错位），单发/连打二选一。",
    "use": "标题/卡片的命中强调，纸墨审美版的\"故障闪\"；A 单发高潮、B 节奏段连打",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "ON THE BEAT"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-riso-misregistration-hit",
    "card": "riso-print-hits",
    "style": "RisoMisregistrationHit",
    "name": "孔版印刷冲击 · RisoMisregistrationHit",
    "category": "effects",
    "description": "套印错位两式——riso-misregistration-hit 单发冲击帧（撞停裂双色版抖两下套准）与 riso-beat-pump 节拍泵（逐拍跳大+错版逐次加码）",
    "intention": "RGB 色散故障闪（impact-feedback C 式的一部分）是荧光屏语言，与纸墨 调性相克。这两式给出印刷版平替：元素裂成浅灰/深墨两份单色印版 （multiply 油墨感而非 screen 荧光感），像 risograph 没对准版，抖几下 \"啪\"地套准——同样的冲击力，介质想象完全换成纸上油墨。A 是单发： 撞停瞬间裂版、震荡衰减、硬切套准，给一次命中盖章；B 是它的节奏化： 每个鼓点整画面跳大 8% + 标题裂版，错位逐拍加码，越打越狠—— 卡点段的视觉低音鼓。同技术根（衰减震荡的双版错位），单发/连打二选一。",
    "use": "标题/卡片的命中强调，纸墨审美版的\"故障闪\"；A 单发高潮、B 节奏段连打",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "IMPACT"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-scan-bracket-sweep",
    "card": "scan-bracket-sweep",
    "style": "scan-bracket-sweep",
    "name": "取景括号扫描",
    "category": "effects",
    "description": "骨架文档弹到中央，四角落下 L 形取景括号，一条 2.5px 实线带渐变拖尾在文档上往复扫 5 趟——文档全程静止，只有光在读它",
    "intention": "让观众看懂\"这份东西正在被机器逐行读过\"。取景括号先把目标框住（宣布检查 对象），扫描光带再往复走完全篇（宣布检查过程）。命门是**文档本身完全静止**： 一旦文档也在动，观众就分不清是\"被检查\"还是\"在加载\"。",
    "use": "\"正在解析/校验这份内容\"的过程镜头；文档类产品的能力演示；上传→分析链路的中段",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-scanline-annotate-focus",
    "card": "scanline-annotate-focus",
    "style": "scanline-annotate-focus",
    "name": "扫描取景标注",
    "category": "effects",
    "description": "一条亮扫描线自上而下掠过页面，扫过之处按先后顺序弹出相机取景框（1.75 倍收拢对准 + 轻微过冲），随后旁侧打出等宽小字标注，顶部状态行同步计数 00/06→06/06",
    "intention": "把\"分析\"这件抽象事做成可见的因果链：扫描线走到哪，那块就被框住、被 命名。观众读的是\"机器的视线\"，所以扫描线必须匀速、标注必须严格滞后于 扫描线过境——**先扫到再弹框**，顺序一旦错乱就变成了预先编排的动画。",
    "use": "\"AI 正在读你的页面/品牌\"的分析镜头；设计系统/品牌规范的拆解介绍；产品能力的自我说明段",
    "frames": 138,
    "holdFrame": 137,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "LOGO · MARK + WORDMARK"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "MODULE · KINETIC TYPE"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "H1 · SERIF DISPLAY"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "CTA · PRIMARY + GHOST"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "FOOTER · LEGAL"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "SOCIAL · BRAND VOICE"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "app.example.com"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "200 OK · TLS"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Acme"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "Studio"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "The headline for"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "your product here"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "H1 · UI-SERIF / GEORGIA"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "GET STARTED"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "DOCS"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "WORK"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "04 / 08"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "sample"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "KINETIC TYPE · 04"
      },
      {
        "key": "copy19",
        "label": "文字 20",
        "default": "00:30"
      },
      {
        "key": "copy20",
        "label": "文字 21",
        "default": "A PRODUCT OF ACME · ACME LABS, INC."
      },
      {
        "key": "copy21",
        "label": "文字 22",
        "default": "x"
      },
      {
        "key": "copy22",
        "label": "文字 23",
        "default": "@USERNAME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-scanline-assemble-flyin",
    "card": "scanline-assemble-flyin",
    "style": "scanline-assemble-flyin",
    "name": "扫描装配飞入",
    "category": "effects",
    "description": "页面开场是空的暗底网格，一条亮扫描线自上而下掠过；扫到每个区块的落点，该处组件就从画外飞入贴合，带残影模糊与落位闪边——扫完整页恰好装配完成",
    "intention": "让\"页面被生成\"这件事有一个可信的施工顺序：扫描线是施工进度条， 组件从画外飞进来贴合是施工动作。关键是**扫完那一刻恰好装完最后一块** ——扫描线提前收工或组件拖尾都会让\"扫描驱动装配\"的因果关系散掉。",
    "use": "\"页面自己生成\"的开场；AI 建站/自动排版类产品的核心演示；从空白到成品的能力叙事",
    "frames": 138,
    "holdFrame": 137,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "app.example.com"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "200 OK · TLS"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Acme"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Studio"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "The headline for"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "your product here"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "H1 · UI-SERIF / GEORGIA"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "GET STARTED"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "DOCS"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "WORK"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "04 / 08"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "sample"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "KINETIC TYPE · 04"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "00:30"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "A PRODUCT OF ACME · ACME LABS, INC."
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "x"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "@USERNAME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-impact-burst-kit",
    "card": "slam-entrance-moves",
    "style": "impact-burst-kit",
    "name": "冲击爆点套件",
    "category": "effects",
    "description": "高能砸入三式——kanada-perspective-snap 金田透视急停、score-slam 比分砸落、impact-burst-kit 落点冲击套件（波及邻卡）",
    "intention": "库内入场词汇的力度上限一直是 deck-deal-flyin 的\"发牌\"——快但不重。 本卡补\"砸\"这一档，三种口味：A 是方向感——卡片带鱼眼级夸张透视贴着 镜头甩进来，\"啪\"地弹平，动漫金田流的潇洒；B 是重量感——KPI 卡从 镜头前 2.5 倍大小砸落，圆环+尘点+震屏三件套同帧起爆，体育比分弹窗 的分量；C 是传导感——B 的三件套之上，冲击波前沿扫过左右邻卡时把 它们可见地推开再弹回，\"这一下震到了邻居\"，一件事说清力量大小。 选型按叙事需要：告诉观众\"它来了\"用 A，\"它很重\"用 B，\"它震动了 全场\"用 C。",
    "use": "主角卡/KPI 卡的重拳入场；impact-feedback 管落位后的反馈，本卡管入场本身就是冲击",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "IMPACT BURST KIT"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-kanada-perspective-snap",
    "card": "slam-entrance-moves",
    "style": "kanada-perspective-snap",
    "name": "金田式透视甩正",
    "category": "effects",
    "description": "高能砸入三式——kanada-perspective-snap 金田透视急停、score-slam 比分砸落、impact-burst-kit 落点冲击套件（波及邻卡）",
    "intention": "库内入场词汇的力度上限一直是 deck-deal-flyin 的\"发牌\"——快但不重。 本卡补\"砸\"这一档，三种口味：A 是方向感——卡片带鱼眼级夸张透视贴着 镜头甩进来，\"啪\"地弹平，动漫金田流的潇洒；B 是重量感——KPI 卡从 镜头前 2.5 倍大小砸落，圆环+尘点+震屏三件套同帧起爆，体育比分弹窗 的分量；C 是传导感——B 的三件套之上，冲击波前沿扫过左右邻卡时把 它们可见地推开再弹回，\"这一下震到了邻居\"，一件事说清力量大小。 选型按叙事需要：告诉观众\"它来了\"用 A，\"它很重\"用 B，\"它震动了 全场\"用 C。",
    "use": "主角卡/KPI 卡的重拳入场；impact-feedback 管落位后的反馈，本卡管入场本身就是冲击",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "KANADA PERSPECTIVE SNAP"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-score-slam",
    "card": "slam-entrance-moves",
    "style": "score-slam",
    "name": "比分砸入",
    "category": "effects",
    "description": "高能砸入三式——kanada-perspective-snap 金田透视急停、score-slam 比分砸落、impact-burst-kit 落点冲击套件（波及邻卡）",
    "intention": "库内入场词汇的力度上限一直是 deck-deal-flyin 的\"发牌\"——快但不重。 本卡补\"砸\"这一档，三种口味：A 是方向感——卡片带鱼眼级夸张透视贴着 镜头甩进来，\"啪\"地弹平，动漫金田流的潇洒；B 是重量感——KPI 卡从 镜头前 2.5 倍大小砸落，圆环+尘点+震屏三件套同帧起爆，体育比分弹窗 的分量；C 是传导感——B 的三件套之上，冲击波前沿扫过左右邻卡时把 它们可见地推开再弹回，\"这一下震到了邻居\"，一件事说清力量大小。 选型按叙事需要：告诉观众\"它来了\"用 A，\"它很重\"用 B，\"它震动了 全场\"用 C。",
    "use": "主角卡/KPI 卡的重拳入场；impact-feedback 管落位后的反馈，本卡管入场本身就是冲击",
    "frames": 135,
    "holdFrame": 134,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SCORE SLAM"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "+247%"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "QUARTERLY GROWTH"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-corner-spotlight-reveal",
    "card": "spotlight-sweep-moves",
    "style": "corner-spotlight-reveal",
    "name": "角落匀速显影",
    "category": "effects",
    "description": "暗场聚光显影三式——A 醒睡扫过（光到即亮光走即暗）、B 贴边泛光横摇（紫光贴 UI 边缘渗入+聚光匀速右移）、C 角落匀速显影（径向聚光从角落匀速扩张点亮全屏）；黑场里\"光即叙事\"的 UI 展示",
    "intention": "黑场里观众只能看见光给看的东西——聚光既是照明也是运镜和剪辑： 光到哪里哪里登场，光走即谢幕。三式共用\"贴边紫色辉光光线\"这个 身份元素（光线贴着 UI 边框/logo/顶边走，辉光要亮要糊，是光在 \"抚摸\"界面而不是描边动画）。命门是**匀速**：聚光的移动/扩张 严格 linear——缓动会让光有\"意图\"，匀速才读作探照灯的机械扫掠 （C 式判例：linear 但半径终值过大＝前 1/4 就饱和，观感照样不匀速）。",
    "use": "暗色调品牌片里逐个介绍 UI 面板/功能区；黑场开场把界面\"点亮\"登场；段落间光转场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Inbox"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "All"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Tasks"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Docs"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "People"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Chat"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-glow-wake-sleep-panel",
    "card": "spotlight-sweep-moves",
    "style": "glow-wake-sleep-panel",
    "name": "醒睡扫过",
    "category": "effects",
    "description": "暗场聚光显影三式——A 醒睡扫过（光到即亮光走即暗）、B 贴边泛光横摇（紫光贴 UI 边缘渗入+聚光匀速右移）、C 角落匀速显影（径向聚光从角落匀速扩张点亮全屏）；黑场里\"光即叙事\"的 UI 展示",
    "intention": "黑场里观众只能看见光给看的东西——聚光既是照明也是运镜和剪辑： 光到哪里哪里登场，光走即谢幕。三式共用\"贴边紫色辉光光线\"这个 身份元素（光线贴着 UI 边框/logo/顶边走，辉光要亮要糊，是光在 \"抚摸\"界面而不是描边动画）。命门是**匀速**：聚光的移动/扩张 严格 linear——缓动会让光有\"意图\"，匀速才读作探照灯的机械扫掠 （C 式判例：linear 但半径终值过大＝前 1/4 就饱和，观感照样不匀速）。",
    "use": "暗色调品牌片里逐个介绍 UI 面板/功能区；黑场开场把界面\"点亮\"登场；段落间光转场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-slide-spotlight-pan",
    "card": "spotlight-sweep-moves",
    "style": "slide-spotlight-pan",
    "name": "贴边泛光横摇",
    "category": "effects",
    "description": "暗场聚光显影三式——A 醒睡扫过（光到即亮光走即暗）、B 贴边泛光横摇（紫光贴 UI 边缘渗入+聚光匀速右移）、C 角落匀速显影（径向聚光从角落匀速扩张点亮全屏）；黑场里\"光即叙事\"的 UI 展示",
    "intention": "黑场里观众只能看见光给看的东西——聚光既是照明也是运镜和剪辑： 光到哪里哪里登场，光走即谢幕。三式共用\"贴边紫色辉光光线\"这个 身份元素（光线贴着 UI 边框/logo/顶边走，辉光要亮要糊，是光在 \"抚摸\"界面而不是描边动画）。命门是**匀速**：聚光的移动/扩张 严格 linear——缓动会让光有\"意图\"，匀速才读作探照灯的机械扫掠 （C 式判例：linear 但半径终值过大＝前 1/4 就饱和，观感照样不匀速）。",
    "use": "暗色调品牌片里逐个介绍 UI 面板/功能区；黑场开场把界面\"点亮\"登场；段落间光转场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-stream-response",
    "card": "ai-stream-response",
    "style": "ai-stream-response",
    "name": "AI 响应汇入",
    "category": "interaction",
    "description": "AI 响应面板先落一句可读摘要，再让带状态图标的证据行逐条汇入，最后统一收束成完成态",
    "intention": "把“AI 正在工作”拍成可读的因果链，而不是日志刷屏：观众先看懂答案摘要， 再看到证据/子任务逐条补齐，最后由完成态确认这轮工作结束。",
    "use": "AI 助手/agent/search/copilot 的结果生成镜头；强调“结论先到、证据随后、任务完成”",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "A"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Ask Atlas"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Workspace agent"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Review this codebase and identify the safest implementation path"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Result summary"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "The codebase is ready for a focused, low-risk implementation."
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Analysis complete"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "7 checks finished · ready to build"
      }
    ],
    "imageKeys": [
      "./agent-stream.jpg"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-autolayout-gap-dial",
    "card": "autolayout-gap-dial",
    "style": "autolayout-gap-dial",
    "name": "间距拨盘布局",
    "category": "interaction",
    "description": "间距拨盘驱动布局——一排链接块带框选描边+缝隙间距标注，徽章数字逐格跳动、块被参数实时推开再弹簧回弹归位；\"参数驱动布局\"的可视化",
    "intention": "\"参数改了、UI 变了\"是设计工具的核心承诺，但通常拍成\"点面板→切 结果\"的前后对比，因果被剪掉了。本卡把因果拍成连续镜头：间距徽章 数字逐格跳，链接块**同帧**被推开，测量线实时拉长——数字就是缰绳， 布局就是马。框选描边+8 手柄+间距标注全是设计工具的母语，观众一眼 认出\"这是在工具里调参数\"。回程故意用欠阻尼弹簧过冲（缩到比起点 更紧再回稳），把\"归位\"做成一次有弹性的收尾。与 type-and-filter 分工：那是\"输入内容→列表收敛\"的检索因果，本卡是\"拨数值→几何 重排\"的参数因果。",
    "use": "设计工具/低代码产品的\"改一个数、界面跟着动\"卖点镜头；\"用设计工具语义做包装\"的品类语言",
    "frames": 120,
    "holdFrame": 119,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "GAP"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-diagram-cascade-build",
    "card": "canvas-materialize-moves",
    "style": "DiagramCascadeBuild",
    "name": "画布物化动效 · DiagramCascadeBuild",
    "category": "interaction",
    "description": "内容\"物化上画布\"两式——panel-to-canvas 行倒卡（面板表格行沿弧线飞出、跨容器变形成画布卡片）与 diagram-cascade 级联生成树（prompt 打字后节点逐层弹出、连线先于节点生长）",
    "intention": "库内生成叙事只有\"面板内流式写入\"（ai-stream-response 证据行汇入面板） 和\"图表自己活起来\"（chart-live-moves），没有词管**内容离开容器、在 开放画布上物化成新实体**。本卡补这一块：画布是舞台，生成物是登台的 演员。A 式的命门是跨容器形态迁移——同一条内容从\"行\"变成\"卡\"，位置 /宽高/圆角/内容布局在一条 spring 上同步插值，观众读到\"是它飞过去 变的\"而不是\"删一个加一个\"；B 式的命门是级联时序——线牵出节点、层 喂出层，结构感来自先后而非同时。",
    "use": "AI/协作工具\"生成结果落到画布上\"的叙事段落；A 式讲\"已有内容换了个存在形态\"，B 式讲\"从一句话长出一棵结构\"",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Generate an entity-relationship diagram"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-panel-to-canvas-materialize",
    "card": "canvas-materialize-moves",
    "style": "PanelToCanvasMaterialize",
    "name": "画布物化动效 · PanelToCanvasMaterialize",
    "category": "interaction",
    "description": "内容\"物化上画布\"两式——panel-to-canvas 行倒卡（面板表格行沿弧线飞出、跨容器变形成画布卡片）与 diagram-cascade 级联生成树（prompt 打字后节点逐层弹出、连线先于节点生长）",
    "intention": "库内生成叙事只有\"面板内流式写入\"（ai-stream-response 证据行汇入面板） 和\"图表自己活起来\"（chart-live-moves），没有词管**内容离开容器、在 开放画布上物化成新实体**。本卡补这一块：画布是舞台，生成物是登台的 演员。A 式的命门是跨容器形态迁移——同一条内容从\"行\"变成\"卡\"，位置 /宽高/圆角/内容布局在一条 spring 上同步插值，观众读到\"是它飞过去 变的\"而不是\"删一个加一个\"；B 式的命门是级联时序——线牵出节点、层 喂出层，结构感来自先后而非同时。",
    "use": "AI/协作工具\"生成结果落到画布上\"的叙事段落；A 式讲\"已有内容换了个存在形态\"，B 式讲\"从一句话长出一棵结构\"",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Add all to canvas"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-chip-grid-single-select-blackout",
    "card": "chip-grid-single-select-blackout",
    "style": "chip-grid-single-select-blackout",
    "name": "灰闪单选反黑",
    "category": "interaction",
    "description": "五个选项 chip 以 3+2 居中排布逐个淡入；选中帧先插一帧灰色按压块，紧接数帧内底色变纯黑、文字变白并做 1→1.04→1 极轻回弹，其余 chip 淡到 18% 但位置锁死；随后余项归零，黑 chip 上移收窄，下方浮现算式行",
    "intention": "一帧灰闪 + 三帧反黑，是把真实 UI 的 `:active → :selected` 两级状态 拆开演。观众看到的是\"手指按下\"再\"系统确认\"，而不是一次渐变。其余 chip 降到 18% 而**位置绝不移动**：一旦重排，观众会以为页面刷新了， \"单选\"的语义就丢了。",
    "use": "单选/套餐/档位选择的交互演示；\"选了它之后会怎样\"的因果镜头；价格/参数结算类链路",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Option one plan"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Option two plan"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Option three long name"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Option four"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Option five variant"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "OPTION GROUP"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-chip-lift-to-user-pill",
    "card": "chip-lift-to-user-pill",
    "style": "chip-lift-to-user-pill",
    "name": "选中长成药丸",
    "category": "interaction",
    "description": "网格里的目标 chip 先 3 帧硬切反色成黑底白字，其余 chip 按到它的曼哈顿距离交错淡出缩小；黑 chip 左缘锚定向右生长成药丸，内部逐字打出人名并点亮绿点，再拉一条 1px 连接线接到圆形徽标",
    "intention": "让\"选中\"这件事有**两段完全不同的质感**：选中瞬间是硬的（3 帧台阶化反色， 像真实 UI 的 `:active`），选中之后是软的（药丸生长、逐字打字、绿点点亮）。 其余 chip 按距离交错淡出，是在告诉观众\"注意力从这里开始收拢\"—— 距离排序比时间排序重要，因为它给出了空间上的因果。",
    "use": "\"从一堆候选里选中并展开这一个\"的交互链路；协作/通讯录/收件人类产品的功能演示；选中→详情的转场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "JD"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "MK"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "CD"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "RL"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "AV"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "TP"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "KN"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "BW"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "CE"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "HR"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "LM"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "DQ"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cursor-cast-ensemble",
    "card": "collab-cursor-moves",
    "style": "CursorCastEnsemble",
    "name": "协作光标演出 · CursorCastEnsemble",
    "category": "interaction",
    "description": "协作光标当演员的两式——dialogue-duet 双光标暗场对话双人舞（靠近/绕位/灯光交接/放大成转场），与 cast-ensemble 五光标群演氛围层（错峰飞入+正弦漂移+打字 cameo+聚拢围观）",
    "intention": "库内光标一直是\"操作工具\"（input-trigger-moves 的 cursor-performance 是单光标点击表演）。本卡把带身份名牌的协作光标升格成**演员**： A 式两枚具名光标在纯暗场用位移编排讲\"设计-开发交接\"——没有一个 UI 元素，观众照样看懂了剧情，光标位置关系就是台词；B 式五枚光标错峰 入场后持续漂移当氛围粒子，\"团队在场\"感全靠它，其中一枚还能停下来 打字（cameo 戏份）。SVG 光标+名牌 chip 成本极低、叙事密度极高， 是\"协作\"主题最便宜的视觉论证。",
    "use": "协作/多人/交接主题的叙事段；A 撑起无 UI 的纯叙事拍，B 给画布场景铺\"团队在场\"体温",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Lisa"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Lucas"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Marta"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Niko"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Rita"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cursor-dialogue-duet",
    "card": "collab-cursor-moves",
    "style": "CursorDialogueDuet",
    "name": "协作光标演出 · CursorDialogueDuet",
    "category": "interaction",
    "description": "协作光标当演员的两式——dialogue-duet 双光标暗场对话双人舞（靠近/绕位/灯光交接/放大成转场），与 cast-ensemble 五光标群演氛围层（错峰飞入+正弦漂移+打字 cameo+聚拢围观）",
    "intention": "库内光标一直是\"操作工具\"（input-trigger-moves 的 cursor-performance 是单光标点击表演）。本卡把带身份名牌的协作光标升格成**演员**： A 式两枚具名光标在纯暗场用位移编排讲\"设计-开发交接\"——没有一个 UI 元素，观众照样看懂了剧情，光标位置关系就是台词；B 式五枚光标错峰 入场后持续漂移当氛围粒子，\"团队在场\"感全靠它，其中一枚还能停下来 打字（cameo 戏份）。SVG 光标+名牌 chip 成本极低、叙事密度极高， 是\"协作\"主题最便宜的视觉论证。",
    "use": "协作/多人/交接主题的叙事段；A 撑起无 UI 的纯叙事拍，B 给画布场景铺\"团队在场\"体温",
    "frames": 140,
    "holdFrame": 139,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-command-palette-summon",
    "card": "command-palette-summon",
    "style": "command-palette-summon",
    "name": "命令面板召唤",
    "category": "interaction",
    "description": "命令面板降临——整屏压暗加模糊，⌘K 面板带过冲弹落，候选行错峰浮现，敲字列表实时收窄",
    "intention": "Raycast/Linear 发布片的标志性仪式：一声轻响，整个 UI 世界压暗 让路，⌘K 面板从中心上方弹落，候选列表错峰浮现；敲两个字母， 列表实时收窄——\"你要的一切都在这个输入框里\"。模拟交互按真人 操作速度走（R3），收窄的\"挤压感\"来自行高塌缩而非淡出。",
    "use": "效率型产品的\"全产品在一个输入框里\"叙事；命令面板/搜索/快捷键功能的标志性登场",
    "frames": 104,
    "holdFrame": 103,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-glass-pill-dictation-typing",
    "card": "glass-pill-dictation-typing",
    "style": "glass-pill-dictation-typing",
    "name": "玻璃胶囊听写",
    "category": "interaction",
    "description": "纯黑底上一条定宽玻璃胶囊以约 1.25 倍略大弹出后缓落到位，内部自左暗到右亮铺一层强调色光；光标先行、随后打字出现占位句，光随打字进度渐渐熄灭，收尾成中性深色玻璃条",
    "intention": "用\"光随输入熄灭\"讲一件很小的事：待命时它在发光（等你说话），你一开口 它就把光让给文字。1.7s 里只做三件事——弹出、打字、光退。任何额外动作 （弹跳、色变、图标动画）都会让这一拍不再是休止符。",
    "use": "语音/AI 输入框的登场；\"跟它说话\"的交互提示镜头；高能段之间的一个安静过渡拍",
    "frames": 50,
    "holdFrame": 49,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Speak or type here"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-hashtag-to-pill-materialize",
    "card": "hashtag-to-pill-materialize",
    "style": "hashtag-to-pill-materialize",
    "name": "话题词实体化",
    "category": "interaction",
    "description": "话题词打字实体化——居中打出 \"#word\"（红实心光标恒亮），1 帧硬切变成宽大胶囊标签，hold 后缩小左移落到页面标签位，再 1 帧硬切揭示成品页；\"两次硬切一次滑动\"的节奏骨架",
    "intention": "文字变实体的常规做法是渐变/morph/展开，原片帧级拆解证明 Bear 反着 来：**实体化是 1 帧硬切**——上一帧还是文字+光标，下一帧就是完整 胶囊，无展开无 cross-fade 无回弹。硬切给的是\"啪、成了\"的确定感， 任何渐变都会把\"实体\"软化成\"特效\"。全段骨架是**两次硬切夹一次 滑动**：硬切实体化 → 平滑缩移归位 → 硬切揭示成品页。唯一的连续 运动（缩移）被两记硬切框住，才显得又快又稳。这个节奏骨架是命门， 三段挪动任何一段的性质（把硬切改渐变、把滑动改硬切）整卡就塌。",
    "use": "标签/分类/关键词功能的演示段（笔记 app 打 tag、话题聚合）；\"输入 → 变成 UI 实体 → 归位到成品\"的三段式叙事",
    "frames": 132,
    "holdFrame": 131,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "music"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "My favorite bands"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "I want to share a few of my favorite bands"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "and the song that I always listen when driving"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "to home. Welcome. Bring headphones."
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cursor-performance-punch-in",
    "card": "input-trigger-moves",
    "style": "CursorPerformancePunchIn",
    "name": "输入触发动效 · CursorPerformancePunchIn",
    "category": "interaction",
    "description": "输入触发两式——cursor-performance 光标表演点击推近、keycap-smash-cut 键帽引信引爆猛切",
    "intention": "发布片的第一人称语法——观众不是在\"看\"产品，是在\"用\"产品：光标 是手、键帽是指尖、触发即叙事。两式共同点：**交互动作当扳机，产品 画面当枪响**。A 是慢扳机——放大光标带性格地滑入点击，镜头以点击点 推近再缓退，有去有回（区别 crash-zoom：慢速、锚定光标、会回来）； C 是引信——假 3D 键帽（⌘K）呼吸悬浮，3f 压扁+底部亮环溢出当引信， 按下引爆 30f 满屏轰鸣，最高潮一帧猛切成整齐静止全景， 按下→爆发→定论。选型：演示交互用 A，开场即高潮用 C。",
    "use": "发布片的第一人称段落：演示核心交互、开场即高潮；观众\"在用\"而不是\"在看\"产品",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Deploy"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-keycap-smash-cut",
    "card": "input-trigger-moves",
    "style": "keycap-smash-cut",
    "name": "键帽砸屏硬切",
    "category": "interaction",
    "description": "输入触发两式——cursor-performance 光标表演点击推近、keycap-smash-cut 键帽引信引爆猛切",
    "intention": "发布片的第一人称语法——观众不是在\"看\"产品，是在\"用\"产品：光标 是手、键帽是指尖、触发即叙事。两式共同点：**交互动作当扳机，产品 画面当枪响**。A 是慢扳机——放大光标带性格地滑入点击，镜头以点击点 推近再缓退，有去有回（区别 crash-zoom：慢速、锚定光标、会回来）； C 是引信——假 3D 键帽（⌘K）呼吸悬浮，3f 压扁+底部亮环溢出当引信， 按下引爆 30f 满屏轰鸣，最高潮一帧猛切成整齐静止全景， 按下→爆发→定论。选型：演示交互用 A，开场即高潮用 C。",
    "use": "发布片的第一人称段落：演示核心交互、开场即高潮；观众\"在用\"而不是\"在看\"产品",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-picker-carousel-feature-cycle",
    "card": "picker-carousel-feature-cycle",
    "style": "picker-carousel-feature-cycle",
    "name": "药丸吸附轮播",
    "category": "interaction",
    "description": "移动端风竖向选择器——焦点药丸不动、内容穿过它，每项带明显 outQuint 减速吸附后完全静止，按到中心距离分层控制透明度/字号/灰度，落定时药丸做 scaleY 极轻呼吸",
    "intention": "把\"选择\"这件事的物理感做出来：焦点框是固定的，是内容在滚动并被吸住。 每项停下后必须**真的静止几帧**——连续滚动读作 loading 动画，停顿才读作 \"这一项被选中了\"。距离衰减（透明度 + 字号 + 灰度三通道同时衰减）是让 观众视线始终锁在中间那一行的唯一手段。",
    "use": "逐个念出功能名/场景名的列表镜头；\"选一个\"的交互演示；移动端产品的 picker 类控件展示",
    "frames": 108,
    "holdFrame": 107,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Data Cleanup"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Direct Message"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Smart Segments"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Batch Actions"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Reward Program"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Automated Flows"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Variant Testing"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "AI"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-segmented-thumb-hero",
    "card": "segmented-thumb-hero",
    "style": "segmented-thumb-hero",
    "name": "分段控件特写",
    "category": "interaction",
    "description": "分段控件 thumb 位移当主角特写——超大胶囊 segmented control 弹簧浮入，描边箭头光标画外滑入按下，白 thumb 8f ease-out 滑到另一段，到位瞬间新图标 spring 弹出、旧图标收起",
    "intention": "产品切到新模式，通常拍法是整个界面换掉。本卡反着来：把 segmented control 放大到 1080px 宽拍特写，**thumb 那 8 帧位移本身就是叙事**—— \"我们从 A 走到了 B\"。没有任何页面上下文，控件即舞台。因果链完整： 光标滑入（有人来了）→ 按下+涟漪（做了决定）→ thumb 滑动（世界响应） → 新图标弹出（新身份确立）。四拍缺一不可，缺了光标就是 UI 自己在动， 缺了图标弹出就是切换没有奖励。",
    "use": "\"模式切换/二选一\"功能的宣告镜头（Ask→Computer、Chat→Agent 式）；一个 UI 微交互撑一整镜的特写拍法",
    "frames": 110,
    "holdFrame": 109,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Ask"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Computer"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-palette-theme-ripple",
    "card": "theme-switch-moves",
    "style": "palette-theme-ripple",
    "name": "调色板主题涟漪",
    "category": "interaction",
    "description": "主题切换两式——theme-sweep 斜向扫场（边界扫过处就地换肤）与 palette-ripple 组合款（⌘K 面板收缩成点、涟漪从点荡开换肤）",
    "intention": "深浅模式切换的两种拍法。A（Notion/Figma/Linear 惯用）：15° 斜向 边界带亮线从左上扫到右下，边界经过处浅色**就地**变深色，同布局 双主题共存一瞬——观众看到的是\"同一个 UI 换肤\"，不是转场。 B（组合变异）：⌘K 面板输入 \"dark\" 回车，面板收缩成一个亮点， 深色涟漪**从该点**荡开扫过全 UI——\"命令引发换肤\"的因果链完整可读。 组合命门：涟漪圆心必须是面板收缩点、起始帧必须是收缩完成帧。",
    "use": "深色模式/主题功能的叙事段落；同一 UI \"在你眼前变色\"而非切到新场景",
    "frames": 95,
    "holdFrame": 94,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "⌘K"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-theme-sweep-toggle",
    "card": "theme-switch-moves",
    "style": "theme-sweep-toggle",
    "name": "主题斜扫切换",
    "category": "interaction",
    "description": "主题切换两式——theme-sweep 斜向扫场（边界扫过处就地换肤）与 palette-ripple 组合款（⌘K 面板收缩成点、涟漪从点荡开换肤）",
    "intention": "深浅模式切换的两种拍法。A（Notion/Figma/Linear 惯用）：15° 斜向 边界带亮线从左上扫到右下，边界经过处浅色**就地**变深色，同布局 双主题共存一瞬——观众看到的是\"同一个 UI 换肤\"，不是转场。 B（组合变异）：⌘K 面板输入 \"dark\" 回车，面板收缩成一个亮点， 深色涟漪**从该点**荡开扫过全 UI——\"命令引发换肤\"的因果链完整可读。 组合命门：涟漪圆心必须是面板收缩点、起始帧必须是收缩完成帧。",
    "use": "深色模式/主题功能的叙事段落；同一 UI \"在你眼前变色\"而非切到新场景",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-type-and-filter",
    "card": "type-and-filter",
    "style": "type-and-filter",
    "name": "打字筛选",
    "category": "interaction",
    "description": "真实 UI 上打字搜索、网格自己收敛成一张卡、点击穿透进详情页",
    "intention": "让观众\"跟着做一遍\"：看清输入了什么、页面怎么响应、点了哪里。这是全片唯一模拟真人操作的镜头，节奏必须像人手，不能像脚本。",
    "use": "功能演示的\"操作叙事\"段；搜索/筛选/进入详情的任何交互链路",
    "frames": 73,
    "holdFrame": 72,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-voice-waveform-live",
    "card": "voice-waveform-live",
    "style": "voice-waveform-live",
    "name": "实时声纹",
    "category": "interaction",
    "description": "录音胶囊实时声纹——64 根细竖条随\"说话\"起伏，说话时中部高耸、停顿缩成点线，波形从右往左滚动；说→停→说→提交塌缩的完整表演",
    "intention": "库里唯一的波形是 spectrum-morph-ui——那是标题下划线裂成频谱条的 **装饰性**音乐可视化。本卡是**功能性**声纹：\"正在听你说\"的实时 回执。区别在因果：spectrum 跟 BGM 跳、是包装；本卡跟\"用户说话\" 跳、是产品功能本身。说话时波形高耸、停顿时缩成一排点线、历史向左 滚出——观众从波形的起伏读出\"它真的在听\"，一段 6s+ 的画面全靠这份 活性撑住，不需要任何别的内容。与 gauge-readout-moves 分工：仪表是 \"报一个数值\"的机械仪式，本卡是\"持续监听\"的生命体征，没有终值。",
    "use": "语音输入/AI 助手\"正在听你说\"的功能镜头；无 UI 内容可展示但需要持续活性撑画面的段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-crane-rise-reveal",
    "card": "crane-rise-reveal",
    "style": "crane-rise-reveal",
    "name": "吊臂升起揭示",
    "category": "opening",
    "description": "升降臂拉升揭示——开场怼在一行数据特写，相机沿 Y 轴减速升起后拉，行行涌入直到整面 dashboard 铺满全幅",
    "intention": "开场定场库内已有 drone-dive-landing——从上帝视角砸进 hero 特写， \"全局→焦点\"。本卡是它的镜像：\"焦点→全局\"——先怼在一行真实数据上 让观众看清\"这是什么\"，再升降臂式拉升后退，一排排内容涌入画面， 最后整面产品铺满——\"你看到的这一行，只是这一面墙的一格\"。 适合以产品体量/内容丰富度为卖点的开场；两卡同片只用一个方向。",
    "use": "\"从细节到全局\"的开场定场；与 drone-dive-landing（全局→单点俯冲）互为反向",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-dataviz-landscape-open",
    "card": "dataviz-landscape-open",
    "style": "dataviz-landscape-open",
    "name": "数据景观开场",
    "category": "opening",
    "description": "暗场支流线束地景开场——多条流线汇入主干、虚构 ID 标签浮在线上、相机重景深低速飞越",
    "intention": "Linear Releases 发布片开场实证的品牌级开场品类：把产品背后的数据世界 拍成一片**暗场地景**——支流线束从画面深处汇入一条主干（\"无数工作流 汇成一个产品\"的隐喻），真实感来自三样东西：①虚构 issue/任务 ID 标签 浮在线上（观众认出\"这是我每天看到的那种东西\"）；②重景深——近景大虚焦 流过、中景标签清晰可读、远景渐隐，三层纵深让平面 SVG 读作空间； ③相机低速匀稳飞越——这是氛围段不是炫技段，速度感交给后面的镜头。 手搓 UI 合规依据：非复刻场景（页面上不存在此画面），按核心理念 1 修订版走质量+表达明确性门槛。",
    "use": "品牌级抽象开场（\"数据宇宙\"隐喻），接亮场产品段或字标；与 glow-flyline-moves 分工：那卡是段落内卡片之间的连线叙事，本卡是开场专用的全画幅地景",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-fracture",
    "card": "fracture",
    "style": "fracture",
    "name": "碎片聚合飞散",
    "category": "opening",
    "description": "5×5 瓦片从 3D 碎片态按中心波纹逐圈聚合成整面海报，停一拍亮字，随后全部碎片背离中心加速旋转飞出画面",
    "intention": "把\"产品成形\"拍成物理事件：碎片从三维空间各自带着旋转飞回原位，观众看着一面完整画面从无序中长出来；hold 读字后再整体炸出画面，把注意力干净地交给下一镜。进出对称，一支素材可正反两用。",
    "use": "开场第一镜\"从混沌到成形\"的品牌/海报揭示；倒放或只取后半可作硬转场",
    "frames": 156,
    "holdFrame": 155,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "REASSEMBLE"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-icon-field-colorize",
    "card": "icon-field-colorize",
    "style": "icon-field-colorize",
    "name": "图标点阵翻色",
    "category": "opening",
    "description": "灰阶小图标点阵错峰浮现铺满全屏，停一拍后多道品牌色横带波纹极快向下扫翻全场——\"功能全景先摆满，品牌一瞬间点亮\"的开场/收束卡",
    "intention": "先用灰阶把\"多\"摆足——上百个小图标错峰浮进来铺满画面，灰阶保证 读作背景纹理不抢戏；停一拍让观众意识到\"摆满了\"，然后品牌色以 横带波纹形式极快扫过全场，灰世界一瞬间被点亮。命门在**翻色不是 同帧硬翻**：原片实测是 ~0.5s 内多道色波依次向下快扫（蓝先覆盖全场， 橙/绿/红依次覆盖更低行带），终态呈四色横带分层——波纹感让\"点亮\" 有方向和速度，硬翻只读作换了张图。",
    "use": "开场铺陈产品能力面（图标=功能宇宙）再一举打上品牌色；功能集合页、生态/集成规模展示、片头 logo 前垫场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-letterspace-materialize",
    "card": "letterspace-materialize",
    "style": "letterspace-materialize",
    "name": "字距结晶字标",
    "category": "opening",
    "description": "大字距字标全字符并行连续描画结晶——所有字母同帧起笔、笔画像手写一样连续生长、同帧齐收成词；氛围底景上的品牌字标显影",
    "intention": "字标不是淡入也不是打字机，而是\"结晶\"：全部字母的笔画同时 开始连续生长，像一只看不见的手同时写所有字母，同一瞬间齐收 成词。两个命门：**连续**（笔画必须是连续画出的过程，不许遮罩 分段——先半截再另半截会被读穿；任何中间帧都该像\"写到一半\"）； **同步**（所有字母同帧起笔、同帧完成——逐字错峰是打字机语义， 这里是整词一体的仪式感）。",
    "use": "片尾/片头品牌字标登场（SUPERHUMAN 式大字距全大写）；章节题字；needs 静谧/高级感的收束帧",
    "frames": 110,
    "holdFrame": 109,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SUPERHUMAN"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-magician-card-flourish",
    "card": "magician-card-flourish",
    "style": "magician-card-flourish",
    "name": "魔术卡弹射",
    "category": "opening",
    "description": "纯黑场上蓝色星芒闪现 0.3s（X 形针状光束旋转 90°+中心辉光放射小光芒），卡片从闪光点弹射而出——极速自旋弧线飞向镜头、自旋随靠近衰减、瞬间硬定格近满幅、定格后 sheen 扫光",
    "intention": "魔术师甩牌：一道蓝色星芒闪过，卡片仿佛从光里被变出来——从画面 中心极远处（视觉上一个小点）弹射而出，沿弧线极速自旋飞向镜头， 到达中心瞬间硬定格成近满幅展示。三个魔术感命门：**闪光先行** （光是\"变\"的仪式，0.3s 短促干脆）、**弹射节奏**（起飞慢速蓄力→ 急加速踢出→弧线段减速抵达，slow-in→burst→decelerating arc）、 **定格即静**（无减速尾巴无回弹，13 整圈自旋保证定格恰为正面）。",
    "use": "单张卡片/海报/封面的魔术性登场（片头主视觉、产品卡揭晓）；纯黑暗场；需要\"变出来\"仪式感的爆点",
    "frames": 141,
    "holdFrame": 140,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-orbit-ring-title-open",
    "card": "orbit-ring-title-open",
    "style": "orbit-ring-title-open",
    "name": "环形卡阵标题开场",
    "category": "opening",
    "description": "八张 16:9 内容卡按 45° 均布在 700×375 椭圆上匀速公转（卡身永不倾斜，纵深只由 sin θ 给出 ±9% 缩放与 z 序），环撑开期间卡内容冻结首帧、f24 之后八张一起开播；居中标题逐字解糊下沉落定，关键词到位那一刻黄色马克块自左横扫铺满，mono 副行随后浮出，末段整行失焦淡出、环继续转着交棒下一镜",
    "intention": "开场想说\"我们有一整套东西\"，最常见的做法是把截图排成网格——但网格是静止的，观众 读到的是\"一堆图片\"，不是\"一套会动的产品\"。这张卡把陈列改成**环形巡回**：八张卡沿 椭圆匀速公转，永远有卡在进画、有卡在出画，画面自带\"还有更多\"的暗示，而标题稳稳 钉在正中间不受影响。 关键的取舍是**卡内容要真的在播**。静态截图上环，观众只会认出\"轮播图\"；卡里跑着真 动效，同一个环立刻变成\"产品在工作\"。但八张卡同时开播会八个动效抢戏，谁也读不进去 ——所以入场期把卡内容**冻结在首帧**，等环撑开、标题起手之后再统一开播。观众的注意 力顺序因此是：先认出这是一圈产品画面 → 读标题 → 才注意到卡里都在动。",
    "use": "开场第一镜 = 「这个产品有一整套东西」；素材库/模板库/功能矩阵/案例集的门面拍；需要用真实运动的产品画面托住一句主张，而不是把截图摆成静态九宫格",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "让镜头卡替你想好每一个动效"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "SESSIONS"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "2026 · Q3"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "GO LIVE"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-stroke-segment-build",
    "card": "stroke-segment-build",
    "style": "stroke-segment-build",
    "name": "描边分段构建",
    "category": "opening",
    "description": "断笔成字——标题拆成十几段互不相连的笔画乱序逐段点亮，前 70% 不可读，末段落位瞬间语义\"啪\"地成立",
    "intention": "《异形》片头判例：标题不是被画出来的，是\"显影\"出来的——拆成离散 笔画段乱序点亮，观众前 70% 时间只看到神秘碎段，最后几段落位的瞬间 突然读出是什么字。\"认出的那一刻\"就是钩子，钩子的强度取决于 不可读期撑多久、钥匙段压多晚。",
    "use": "开场吊悬念的产品名/大数字揭晓；一支片 ≤1 次；与 type-assembly/draw-svg-trace 分工：那些是\"看着字被组装/描画\"，本卡是\"意义延迟揭晓\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "STROKE SEGMENT BUILD"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-text-as-mask",
    "card": "text-as-mask",
    "style": "text-as-mask",
    "name": "文字蒙版",
    "category": "opening",
    "description": "文字视频遮罩——超粗大标题字内部透出缓慢平移的产品画面，结尾字形放大 26 倍溢出、内部画面接管全屏",
    "intention": "标题和产品画面抢屏幕是老问题——先字后画慢，画上压字挤。这一式让 两者同体：字形就是遮罩，产品只透过笔画显形，观众同时读到词和画面 质感；结尾字形胀开溢出画幅，产品自然接管全屏——\"从品牌词走进产品\" 一条镜头说完，兼任章节转场（与 transition-travel C 字腔穿越同族： 那边是镜头钻进字腔，这边是字形自己胀开，前者相机动、后者门动）。",
    "use": "品牌词/口号与产品画面二合一的开场或章节卡；字是门、产品在门里",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "TEXT AS MASK"
      },
      {
        "key": "copy1",
        "label": "蒙版标题（短词）",
        "default": "SCALE"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-logo-sting-button",
    "card": "edit-hook-moves",
    "style": "logo-sting-button",
    "name": "字标彩蛋收尾",
    "category": "outro",
    "description": "logo-sting-button 片尾钩子——片尾 logo 定住后突插 12f 彩蛋再收，预告片 button ending",
    "intention": "库内声画卡管的都是\"画面上的事\"；这一式管**时间线本身的修辞**—— 终点的反悔：收黑→logo 淡入定住（观众以为结束）→突然 12f UI 特写 彩蛋硬切插入→切回 logo 收尾，预告片 button ending，留最后一个钩子。 拿观众的\"已经结束了\"的预期开玩笑。",
    "use": "片尾收束（全片 ≤1 次）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "ACME"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-grain-dissolve",
    "card": "grain-dissolve",
    "style": "grain-dissolve",
    "name": "文字砂化凝聚",
    "category": "outro",
    "description": "整行字爆裂成沸腾颗粒噪点并浮现斜纹选区框，噪点云急速凝聚成更大号发光短字标，位移衰减归零定格",
    "intention": "把\"一句话浓缩成一个词\"拍成物理事件：句子先失稳沸腾成颗粒（信息解体），选区框暗示\"正在选中提取\"，然后所有颗粒能量向中心坍缩成更大更亮的短字标——观众读到的是\"这一切归结为它\"。",
    "use": "收尾\"XX. Now Live\"式上线宣告；长句信息压缩成品牌短标的能量聚合拍",
    "frames": 60,
    "holdFrame": 59,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "{ ACME. Now Live }"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "ACME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-logo-shrink-wordmark-lockup",
    "card": "logo-shrink-wordmark-lockup",
    "style": "logo-shrink-wordmark-lockup",
    "name": "图标收束落位",
    "category": "outro",
    "description": "霓虹切口大环快速收束成中央实心小白 O 并带过冲刹车，图标左移让位，字母逐个滑入完成 lockup，强调色标语收尾",
    "intention": "片尾的\"盖章\"动作：满屏的霓虹大环携能量坍缩成一枚小图标，愈合缺口、转为纯白（从演出态到标准态），然后按品牌 lockup 的规范一步步落位——图标让位、字标进场、标语押尾。观众看到的是品牌从动态里\"站定\"。",
    "use": "片尾品牌定妆：从满屏图形能量收束到\"图标+字标+标语\"的标准 lockup",
    "frames": 132,
    "holdFrame": 131,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BUILD. SHIP. REPEAT."
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "BRAND"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-neon-triple-marquee",
    "card": "neon-triple-marquee",
    "style": "neon-triple-marquee",
    "name": "三行霓虹跑马灯",
    "category": "outro",
    "description": "三行对向霓虹跑马灯 recap——BETTER/FASTER/STRONGER 空心描边巨字上中下排满全屏，奇偶行反向匀速无限横滚，三行按 1/3 相位轮流亮起，结尾整组淡出",
    "intention": "一行 marquee 只是网页装饰；三行叠起来、奇偶反向、再让亮度按相位轮流 走，就成了\"主题词在观众眼前列队巡游\"。命门是**明暗轮唱**：任一时刻 只有一行是霓虹主角，其余压暗成细描边背景——三行全亮是灯牌事故， 轮流亮才是 recap。反向对滚制造\"包围感\"：上下行向右、中行向左， 视线被夹在中间，词从两侧源源不断流过，读作\"这三个词说不完\"。",
    "use": "片尾主题词复读机段落；三连词口号的\"余韵\"拍法（cel-flash-stomp 砸完之后的低一档收尾）；音乐段无旁白铺陈",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BETTER"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FASTER"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "STRONGER"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-outro-group-photo-launch",
    "card": "outro-group-photo-launch",
    "style": "outro-group-photo-launch",
    "name": "发布会合影收场",
    "category": "outro",
    "description": "全片元素从四面八方飞来围住字标合影，crane 落机位+舞台光+金尘做成发布会收场",
    "intention": "把看过的每个功能各抽一个代表元素叫回来合影，字标压轴登场——观众离场前最后记住的是\"这些东西属于同一个产品\"。规格必须是发布会级：能量推到全片最高。",
    "use": "outro/品牌收尾；多功能产品的\"全家福\"式终镜",
    "frames": 145,
    "holdFrame": 144,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Team Research Console"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-ui-strip-away-outro",
    "card": "ui-strip-away-outro",
    "style": "ui-strip-away-outro",
    "name": "减法收尾",
    "category": "outro",
    "description": "减法式收尾——点击 Publish 后整个编辑器 UI 从外围到中心层层错峰蒸发，黑场上只剩那颗按钮滑到屏心放大，按钮再淡出交棒字标定版",
    "intention": "库内收尾全是\"加法\"：outro-group-photo-launch 元素飞来合影，logo sting 是定住再彩蛋。本卡是唯一的\"减法\"路线——点击引爆全 UI 退场， 黑场只留语义焦点（那颗被点的按钮），把\"发布 = 复杂性归零\"翻译成 动效叙事。命门有二：**蒸发要有秩序**——从外围到中心每 4f 一层、 每层带方向性位移（各自往画外散），乱序或同帧齐灭读作断电故障； **按钮是唯一幸存者且必须迁移**——蒸发期间从工具条角落滑到屏心 放大 1.5 倍、白晕随黑场增强，完成从\"UI 控件\"到\"仪式主角\"的升格， 最后淡出把黑场交给字标。",
    "use": "\"发布/完成\"语义的 outro；想讲\"一键之后一切复杂性消失\"的产品收尾",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Publish"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "WORDMARK"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-icon-flip-bloom-logo",
    "card": "ui-to-brand-morph",
    "style": "IconFlipBloomLogo",
    "name": "UI 变品牌 · IconFlipBloomLogo",
    "category": "outro",
    "description": "UI 变品牌两式——icon-flip-bloom 图标 Y 轴翻扁成竖线绽放成花形 mark + wordmark 逐字落定，与 input-morph-assemble 输入框收缩成胶囊、三粒图元落下集结成 logo 单瓣",
    "intention": "品牌收尾库里已有三条路：brand-ink-open 是开场描画压印、 morph-from-primitive 是图元→UI 容器（方向相反）、 outro-group-photo-launch 是元素围拢合影（聚而不变）。本卡补第四条： **产品 UI 元素自己变形成品牌符号**——A 式是图标翻一个身变成 logo （同位实体交换），B 式是全片反复出现的输入框在最后一次发送后集结成 logo 单瓣（多元素落位拼装）。观众看到的不是\"logo 出现了\"，而是 \"刚才用的东西原来就是它\"，因果链本身就是品牌论证。",
    "use": "品牌收尾/outro 前最后一拍；\"你每天用的那个 UI 就是这个品牌\"的视觉论证",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "perplexity"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-input-morphs-into-logo",
    "card": "ui-to-brand-morph",
    "style": "InputMorphsIntoLogo",
    "name": "UI 变品牌 · InputMorphsIntoLogo",
    "category": "outro",
    "description": "UI 变品牌两式——icon-flip-bloom 图标 Y 轴翻扁成竖线绽放成花形 mark + wordmark 逐字落定，与 input-morph-assemble 输入框收缩成胶囊、三粒图元落下集结成 logo 单瓣",
    "intention": "品牌收尾库里已有三条路：brand-ink-open 是开场描画压印、 morph-from-primitive 是图元→UI 容器（方向相反）、 outro-group-photo-launch 是元素围拢合影（聚而不变）。本卡补第四条： **产品 UI 元素自己变形成品牌符号**——A 式是图标翻一个身变成 logo （同位实体交换），B 式是全片反复出现的输入框在最后一次发送后集结成 logo 单瓣（多元素落位拼装）。观众看到的不是\"logo 出现了\"，而是 \"刚才用的东西原来就是它\"，因果链本身就是品牌论证。",
    "use": "品牌收尾/outro 前最后一拍；\"你每天用的那个 UI 就是这个品牌\"的视觉论证",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Ready, set, go!"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-beat-cut-accelerando",
    "card": "beat-cut-moves",
    "style": "beat-cut-accelerando",
    "name": "递进硬切串",
    "category": "rhythm",
    "description": "硬切当节拍乐器的两式——递进硬切串（间隔减半加速逼近）与连闪定格（三次白闪各切一个裁切）",
    "intention": "库内节奏词汇一直只管\"一条运动内\"的速率（speed-ramp 是同一条 take 里变速）和\"落定后停多久\"（R 系呼吸判例），没有词管**多镜之间切点 怎么排**。本卡补这一块：硬切不做任何过渡，切点间隔本身就是乐谱—— 间隔递减读作加速逼近（A），等距三闪读作快门连拍（B）。与 R 系不 冲突：R 管落定后的停，本卡管切点排布，切串结束必须接足量 hold 把 呼吸还回去。注意这是刻意的例外——节奏偏好判例是单向\"放慢\"，硬切 串切得越狠，切完的 hold 要比平常更长。",
    "use": "高光/冲刺段落把\"切\"本身打成鼓点；A 式预告片式加速逼近，B 式颁奖连拍仪式感",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-paparazzi-flash",
    "card": "beat-cut-moves",
    "style": "paparazzi-flash",
    "name": "连闪定格",
    "category": "rhythm",
    "description": "硬切当节拍乐器的两式——递进硬切串（间隔减半加速逼近）与连闪定格（三次白闪各切一个裁切）",
    "intention": "库内节奏词汇一直只管\"一条运动内\"的速率（speed-ramp 是同一条 take 里变速）和\"落定后停多久\"（R 系呼吸判例），没有词管**多镜之间切点 怎么排**。本卡补这一块：硬切不做任何过渡，切点间隔本身就是乐谱—— 间隔递减读作加速逼近（A），等距三闪读作快门连拍（B）。与 R 系不 冲突：R 管落定后的停，本卡管切点排布，切串结束必须接足量 hold 把 呼吸还回去。注意这是刻意的例外——节奏偏好判例是单向\"放慢\"，硬切 串切得越狠，切完的 hold 要比平常更长。",
    "use": "高光/冲刺段落把\"切\"本身打成鼓点；A 式预告片式加速逼近，B 式颁奖连拍仪式感",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "84,213"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-beat-step-list-theme-cycle",
    "card": "beat-step-list-theme-cycle",
    "style": "beat-step-list-theme-cycle",
    "name": "节拍列表换色",
    "category": "rhythm",
    "description": "三通道节拍器——深色场形容词列表逐拍上移一行，视口中央固定胶囊\"接住\"下一个词并换色，整场底色同拍跟换；行、色、场三通道锁死同一拍点",
    "intention": "换一次主题色是功能演示；0.6 秒换一次、连换三次、每次\"选中行+胶囊色 +全场底色\"三件事同帧齐跳——就成了节拍器。用最便宜的变量切换做出 全片最高的节奏密度。命门有二：一是**三通道必须锁同一拍点**，任何 一通道慢半拍，\"齐跳\"退化成三个各自为政的动画；二是**跳与滑的分界** ——跳变只占拍头 6f，其余 12f 完全静置，拍点要\"跳\"不要\"滑\"， 匀速滚动的列表就只是列表。",
    "use": "\"同一产品多种气质/多主题展示\"段落（modern/playful/expressive 式形容词连打）；全片节奏最密的一段；音乐段对拍",
    "frames": 110,
    "holdFrame": 109,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "modern"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "playful"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "expressive"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "seamless"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "intuitive"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-domino-cascade",
    "card": "montage-rhythm-moves",
    "style": "domino-cascade",
    "name": "多米诺连锁入场",
    "category": "rhythm",
    "description": "蒙太奇节奏三式——drop-blackout-slam 黑场蓄爆、wright-triple-cut 三连咔哒特写、domino-cascade 多米诺连锁入场",
    "intention": "beat-cut-moves 管切点间隔怎么排，这三式管更大一层的节奏叙事： A 是\"静默即蓄力\"——drop 前一拍切全黑死寂憋一整拍，爆开才够响 （EDM 演出 blackout 惯例），给全片最高潮的前一秒用；B 是\"流程三连\" ——三个超近特写咔哒咔哒咔哒连打（按下/拨动/翻牌），第三声甩回全景 亮结果，Edgar Wright 式把\"操作很简单\"剪成肌肉记忆；C 是\"动量传递\" ——标题砸落震起卡片、卡片落地撞进侧边栏，每个元素的入场由上一个的 撞击触发，Rube Goldberg 式把一页内容的入场讲成连锁反应。",
    "use": "段落级节奏设计：蓄力爆发（A）、流程速写（B）、开场连锁（C）；与 beat-cut-moves（切点排布）互补——这三式管\"段落的呼吸形状\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CHAIN REACTION"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-drop-blackout-slam",
    "card": "montage-rhythm-moves",
    "style": "drop-blackout-slam",
    "name": "黑场蓄爆",
    "category": "rhythm",
    "description": "蒙太奇节奏三式——drop-blackout-slam 黑场蓄爆、wright-triple-cut 三连咔哒特写、domino-cascade 多米诺连锁入场",
    "intention": "beat-cut-moves 管切点间隔怎么排，这三式管更大一层的节奏叙事： A 是\"静默即蓄力\"——drop 前一拍切全黑死寂憋一整拍，爆开才够响 （EDM 演出 blackout 惯例），给全片最高潮的前一秒用；B 是\"流程三连\" ——三个超近特写咔哒咔哒咔哒连打（按下/拨动/翻牌），第三声甩回全景 亮结果，Edgar Wright 式把\"操作很简单\"剪成肌肉记忆；C 是\"动量传递\" ——标题砸落震起卡片、卡片落地撞进侧边栏，每个元素的入场由上一个的 撞击触发，Rube Goldberg 式把一页内容的入场讲成连锁反应。",
    "use": "段落级节奏设计：蓄力爆发（A）、流程速写（B）、开场连锁（C）；与 beat-cut-moves（切点排布）互补——这三式管\"段落的呼吸形状\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "DROP"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-wright-triple-cut",
    "card": "montage-rhythm-moves",
    "style": "wright-triple-cut",
    "name": "三连特写",
    "category": "rhythm",
    "description": "蒙太奇节奏三式——drop-blackout-slam 黑场蓄爆、wright-triple-cut 三连咔哒特写、domino-cascade 多米诺连锁入场",
    "intention": "beat-cut-moves 管切点间隔怎么排，这三式管更大一层的节奏叙事： A 是\"静默即蓄力\"——drop 前一拍切全黑死寂憋一整拍，爆开才够响 （EDM 演出 blackout 惯例），给全片最高潮的前一秒用；B 是\"流程三连\" ——三个超近特写咔哒咔哒咔哒连打（按下/拨动/翻牌），第三声甩回全景 亮结果，Edgar Wright 式把\"操作很简单\"剪成肌肉记忆；C 是\"动量传递\" ——标题砸落震起卡片、卡片落地撞进侧边栏，每个元素的入场由上一个的 撞击触发，Rube Goldberg 式把一页内容的入场讲成连锁反应。",
    "use": "段落级节奏设计：蓄力爆发（A）、流程速写（B）、开场连锁（C）；与 beat-cut-moves（切点排布）互补——这三式管\"段落的呼吸形状\"",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "1"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-comic-panel-split",
    "card": "panel-grid-moves",
    "style": "comic-panel-split",
    "name": "漫画分镜切屏",
    "category": "rhythm",
    "description": "分格节奏三式——grid-flash-mosaic 九宫格闪切填墙吞屏、flip-grid-reflow 网格集体重排、comic-panel-split 漫画斜格三机位并列",
    "intention": "与 wall-reveal-moves 的区别是本卡的定位锚：那是\"整墙怎么入场\" （一次性揭示），这是\"格子怎么当节奏器\"——分格、重排、并列都发生 在节拍上，格变即鼓点。A 是填：3×3 格按十六分音符乱序逐格啪啪硬入， 填满停一拍，中心格放大吞掉全屏——功能矩阵一秒全亮相；B 是移：6 张卡 在节拍点集体直线换位（横排→3×2 网格），半秒落定 + 加深脉冲收束—— 布局重排本身当一个鼓点；C 是并：画面咔咔切成 3 个斜线分格，同一产品 三种机位同时定格，停半拍后一格斜边扩张吃掉全屏——Scott Pilgrim 的 分屏语言。按需选：多功能亮相用 A，布局叙事用 B，单品多视角用 C。",
    "use": "把\"格子\"当节奏器：逐格踩拍亮相（A）、节拍点集体换位（B）、同主体多机位定格并列（C）；三式都吃拍点",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "1,284"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-flip-grid-reflow",
    "card": "panel-grid-moves",
    "style": "flip-grid-reflow",
    "name": "翻转网格重排",
    "category": "rhythm",
    "description": "分格节奏三式——grid-flash-mosaic 九宫格闪切填墙吞屏、flip-grid-reflow 网格集体重排、comic-panel-split 漫画斜格三机位并列",
    "intention": "与 wall-reveal-moves 的区别是本卡的定位锚：那是\"整墙怎么入场\" （一次性揭示），这是\"格子怎么当节奏器\"——分格、重排、并列都发生 在节拍上，格变即鼓点。A 是填：3×3 格按十六分音符乱序逐格啪啪硬入， 填满停一拍，中心格放大吞掉全屏——功能矩阵一秒全亮相；B 是移：6 张卡 在节拍点集体直线换位（横排→3×2 网格），半秒落定 + 加深脉冲收束—— 布局重排本身当一个鼓点；C 是并：画面咔咔切成 3 个斜线分格，同一产品 三种机位同时定格，停半拍后一格斜边扩张吃掉全屏——Scott Pilgrim 的 分屏语言。按需选：多功能亮相用 A，布局叙事用 B，单品多视角用 C。",
    "use": "把\"格子\"当节奏器：逐格踩拍亮相（A）、节拍点集体换位（B）、同主体多机位定格并列（C）；三式都吃拍点",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "FLIP GRID REFLOW"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-grid-flash-mosaic",
    "card": "panel-grid-moves",
    "style": "grid-flash-mosaic",
    "name": "网格闪切马赛克",
    "category": "rhythm",
    "description": "分格节奏三式——grid-flash-mosaic 九宫格闪切填墙吞屏、flip-grid-reflow 网格集体重排、comic-panel-split 漫画斜格三机位并列",
    "intention": "与 wall-reveal-moves 的区别是本卡的定位锚：那是\"整墙怎么入场\" （一次性揭示），这是\"格子怎么当节奏器\"——分格、重排、并列都发生 在节拍上，格变即鼓点。A 是填：3×3 格按十六分音符乱序逐格啪啪硬入， 填满停一拍，中心格放大吞掉全屏——功能矩阵一秒全亮相；B 是移：6 张卡 在节拍点集体直线换位（横排→3×2 网格），半秒落定 + 加深脉冲收束—— 布局重排本身当一个鼓点；C 是并：画面咔咔切成 3 个斜线分格，同一产品 三种机位同时定格，停半拍后一格斜边扩张吃掉全屏——Scott Pilgrim 的 分屏语言。按需选：多功能亮相用 A，布局叙事用 B，单品多视角用 C。",
    "use": "把\"格子\"当节奏器：逐格踩拍亮相（A）、节拍点集体换位（B）、同主体多机位定格并列（C）；三式都吃拍点",
    "frames": 140,
    "holdFrame": 139,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-quad-split-parallel-scenes",
    "card": "quad-split-parallel-scenes",
    "style": "quad-split-parallel-scenes",
    "name": "四宫并行蒙太奇",
    "category": "rhythm",
    "description": "画面硬切 2×2 四宫格，四个象限并行跑各自的微场景（打字、急推、逐词、交互链），关键节拍错开 3–6 帧制造信息轰炸",
    "intention": "用并行密度替代顺序展示：四件事同时在眼前发生，观众来不及逐一细读，但每 3–6 帧就有一个象限\"动一下\"——扫视节奏被牢牢钉住。这是手法卡：格内内容全部可替换，错拍编排才是配方。",
    "use": "节奏段\"功能很多、同时发生\"的蒙太奇拍；预告片中段的密度峰值",
    "frames": 63,
    "holdFrame": 62,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "One"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "clear"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "message"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "✦ Section label ›"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "You · just now"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "All good!"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "00:00"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-jump-cut-punch-in",
    "card": "rhythm-interrupt-moves",
    "style": "jump-cut-punch-in",
    "name": "跳切递进推近",
    "category": "rhythm",
    "description": "打断节奏两式——jump-cut-punch-in 三级跳切推近、strobe-black-frames 频闪黑帧",
    "intention": "库内节奏卡管的都是\"怎么切、切多密\"；这两式管**怎么断**——观众预期 连续，你偏打断，打断方式即表达：B 是空间断——同构图三次无补间跳大 （1x→1.6x→2.6x），戈达尔跳切的顿挫，比连续推近更有\"看这里、再近点、 就是它\"的指令感；C 是存在断——画面与纯黑交替频闪且间隔收紧， 高潮前的窒息倒数。选型：强制聚焦指标用 B，高潮前蓄压用 C。",
    "use": "用\"打断连续性\"本身当节奏器：顿挫推近（B）、窒息逼近（C）；与 beat-cut-moves（切点排布）、montage-rhythm（段落呼吸）互补",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "JUMP CUT PUNCH-IN"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-strobe-black-frames",
    "card": "rhythm-interrupt-moves",
    "style": "strobe-black-frames",
    "name": "黑帧频闪倒数",
    "category": "rhythm",
    "description": "打断节奏两式——jump-cut-punch-in 三级跳切推近、strobe-black-frames 频闪黑帧",
    "intention": "库内节奏卡管的都是\"怎么切、切多密\"；这两式管**怎么断**——观众预期 连续，你偏打断，打断方式即表达：B 是空间断——同构图三次无补间跳大 （1x→1.6x→2.6x），戈达尔跳切的顿挫，比连续推近更有\"看这里、再近点、 就是它\"的指令感；C 是存在断——画面与纯黑交替频闪且间隔收紧， 高潮前的窒息倒数。选型：强制聚焦指标用 B，高潮前蓄压用 C。",
    "use": "用\"打断连续性\"本身当节奏器：顿挫推近（B）、窒息逼近（C）；与 beat-cut-moves（切点排布）、montage-rhythm（段落呼吸）互补",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "STROBE BLACK FRAMES"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-sakuga-timing-shift",
    "card": "sakuga-timing-shift",
    "style": "sakuga-timing-shift",
    "name": "作画式节奏变拍",
    "category": "rhythm",
    "description": "一拍三转一拍一——元素先以每 3 帧一步的手翻书顿挫移动，高潮瞬间切成逐帧丝滑冲刺，帧率量化的突变本身就是看点",
    "intention": "库内时间轴操纵已有 speed-ramp 连续变速与 hit-counter 的局部顿帧。 本卡是另一种——**改的不是速度是帧率本身**： 顿挫段驱动帧 q=floor(f/3)*3，元素每 3 帧才动一步（10fps 手翻书）， 切换帧起改用原始 f 逐帧驱动，丝滑冲刺。一拍三的钝与一拍一的滑 同屏对切，日式作画的拍数演出（shooting on 3s / on 1s）。顿挫段 不是低级感是手工感，切换点即高潮标记。",
    "use": "单元素的强调性位移（卡片入场、指标冲线）；需要\"手工感→高潮爆发\"反差的段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SAKUGA TIMING SHIFT"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-smear-multiples",
    "card": "smear-multiples",
    "style": "smear-multiples",
    "name": "拖影分身",
    "category": "rhythm",
    "description": "残像分身——卡片高速横移时拖 4 个清晰可数的半透明分身副本，落位瞬间收拢合一；motion blur 的动画式平替",
    "intention": "快速位移的速度感库内标准答案是 CameraMotionBlur（摄影隐喻：快门拖影， 连续的糊）。本卡给第二个答案，动漫演出的 smear frame 传统：残像是 **离散、清晰、可数的**完整副本——观众能数出 4 张卡，读作\"快到留下 分身\"而非\"快到糊掉\"。两者气质完全不同：blur 是实拍级质感，分身是 漫画级趣味；同一次位移二选一，叠用读作渲染错误。分身式还有一个 实用优势：残像里内容仍可辨，适合\"移动的东西本身是信息\"的场景。",
    "use": "元素高速位移段想要\"漫画式速度感\"而非\"摄影式模糊\"时；与 CameraMotionBlur 二选一",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SMEAR MULTIPLES"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-spectrum-morph-ui",
    "card": "spectrum-morph-ui",
    "style": "spectrum-morph-ui",
    "name": "频谱变形界面",
    "category": "rhythm",
    "description": "频谱化 UI——标题下划线裂成一排竖条按频谱跳动两小节，再收拢还原成直线；音乐可视化长在 UI 上",
    "intention": "声画同步库内已有 type-rhythm-sync A（字重脉冲）——那是\"文字自己动\"； 本卡是\"UI 构件变成均衡器\"：下划线这个最不起眼的构件被音乐借用两小节， 裂成 28 根竖条跳出频谱，然后**收拢还原、完璧归赵**。借用-归还结构是 全部优雅所在——观众先认出\"这是下划线\"，再看它变成别的东西，最后 看它变回来；若一开始就是频谱条，只是又一个音乐可视化。跳完必须还原 成那条 8px 直线，一像素不差。",
    "use": "有音轨片子的声画同步高光段（BGM 副歌起/鼓点密集段）；标题字卡、章节页的下划线/分隔线构件",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "LAUNCH WEEK"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-freeze-annotate-real",
    "card": "speed-ramp-freeze",
    "style": "FreezeAnnotateReal",
    "name": "变速与定格 · FreezeAnnotateReal",
    "category": "rhythm",
    "description": "帧号非线性 remap 的两款节奏手法——变速（快→0.2x 凝视→快）与定格标注（流动→定格圈注→解冻）",
    "intention": "匀速流读作 PPT（R2），全程快流观众抓不住重点（R3）。变速在一条 运动里制造\"冲刺-凝视-冲刺\"；定格标注更进一步——干脆停下来， 马克笔圈出重点再走。两款同一技术根（帧号 remap），语义不同： 变速是\"路过时多看一眼\"，定格是\"停课划重点\"。",
    "use": "卡片流/长横移中把一个重点\"放慢/停下给人看\"；教学解说语境用定格标注",
    "frames": 135,
    "holdFrame": 134,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-speed-ramp-real",
    "card": "speed-ramp-freeze",
    "style": "SpeedRampReal",
    "name": "变速与定格 · SpeedRampReal",
    "category": "rhythm",
    "description": "帧号非线性 remap 的两款节奏手法——变速（快→0.2x 凝视→快）与定格标注（流动→定格圈注→解冻）",
    "intention": "匀速流读作 PPT（R2），全程快流观众抓不住重点（R3）。变速在一条 运动里制造\"冲刺-凝视-冲刺\"；定格标注更进一步——干脆停下来， 马克笔圈出重点再走。两款同一技术根（帧号 remap），语义不同： 变速是\"路过时多看一眼\"，定格是\"停课划重点\"。",
    "use": "卡片流/长横移中把一个重点\"放慢/停下给人看\"；教学解说语境用定格标注",
    "frames": 135,
    "holdFrame": 134,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-card-footage-cadence",
    "card": "trailer-grammar-moves",
    "style": "card-footage-cadence",
    "name": "卡片与画面节奏交替",
    "category": "rhythm",
    "description": "预告片语法三式——trailer-bumper 前置速剪钩子、card-footage-cadence 字卡穿插对话、smash-cut 猛切入定",
    "intention": "库内节奏卡各管一段：beat-cut 管切点排布、montage-rhythm 管段落呼吸、 rhythm-interrupt 管打断。本卡管**预告片的结构性时刻**——不是某个 镜头怎么动，是整片的三个关节怎么接：A 是开场钩——正片前 0.9 秒塞 三个最抓眼镜头速剪 + 黑场静默一拍再开场，预告片的\"预告\"；B 是中段 对话——UI 镜头与黑底短语卡互相接拍交替硬切，画面与文字都踩拍点， 第三幕结构；C 是高潮句号——满屏动势轰鸣最高潮一帧硬切成整齐静止 全景死寂，喧闹→死寂。三式合用即一支预告片的骨架。",
    "use": "预告片的三个结构性时刻：开场怎么钩（A）、中段怎么对话（B）、高潮怎么收（C）；三式合用即一支预告片的骨架",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SHIP"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FASTER"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "TODAY"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-smash-cut",
    "card": "trailer-grammar-moves",
    "style": "smash-cut",
    "name": "冲脸硬切",
    "category": "rhythm",
    "description": "预告片语法三式——trailer-bumper 前置速剪钩子、card-footage-cadence 字卡穿插对话、smash-cut 猛切入定",
    "intention": "库内节奏卡各管一段：beat-cut 管切点排布、montage-rhythm 管段落呼吸、 rhythm-interrupt 管打断。本卡管**预告片的结构性时刻**——不是某个 镜头怎么动，是整片的三个关节怎么接：A 是开场钩——正片前 0.9 秒塞 三个最抓眼镜头速剪 + 黑场静默一拍再开场，预告片的\"预告\"；B 是中段 对话——UI 镜头与黑底短语卡互相接拍交替硬切，画面与文字都踩拍点， 第三幕结构；C 是高潮句号——满屏动势轰鸣最高潮一帧硬切成整齐静止 全景死寂，喧闹→死寂。三式合用即一支预告片的骨架。",
    "use": "预告片的三个结构性时刻：开场怎么钩（A）、中段怎么对话（B）、高潮怎么收（C）；三式合用即一支预告片的骨架",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-trailer-bumper",
    "card": "trailer-grammar-moves",
    "style": "trailer-bumper",
    "name": "预告片冷开场",
    "category": "rhythm",
    "description": "预告片语法三式——trailer-bumper 前置速剪钩子、card-footage-cadence 字卡穿插对话、smash-cut 猛切入定",
    "intention": "库内节奏卡各管一段：beat-cut 管切点排布、montage-rhythm 管段落呼吸、 rhythm-interrupt 管打断。本卡管**预告片的结构性时刻**——不是某个 镜头怎么动，是整片的三个关节怎么接：A 是开场钩——正片前 0.9 秒塞 三个最抓眼镜头速剪 + 黑场静默一拍再开场，预告片的\"预告\"；B 是中段 对话——UI 镜头与黑底短语卡互相接拍交替硬切，画面与文字都踩拍点， 第三幕结构；C 是高潮句号——满屏动势轰鸣最高潮一帧硬切成整齐静止 全景死寂，喧闹→死寂。三式合用即一支预告片的骨架。",
    "use": "预告片的三个结构性时刻：开场怎么钩（A）、中段怎么对话（B）、高潮怎么收（C）；三式合用即一支预告片的骨架",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "THE LAUNCH"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-bottom-push-stack-wipe",
    "card": "bottom-push-stack-wipe",
    "style": "bottom-push-stack-wipe",
    "name": "底推换章",
    "category": "transition",
    "description": "底边上推换章——新场景连底色整屏从底边向上推入，把旧场景物理顶出画外，连推数章各配一种饱和底色，内容钉死在各自色底坐标系里随底色走",
    "intention": "wipe-transitions 是一条边界扫过、新旧页都不动；page-turn 是立方体 翻转。本卡是第三种物性：**新章把旧章顶出去**——两屏刚性接触、同速 同向位移，像自动售货机压栈。命门是\"连底色整屏走\"：底色+窗口卡+装饰 条焊成一块整料从底边推入，观众读到\"换了个世界\"而不是\"换了张卡\"。 重 ease-out（快进慢停）给推入一个\"哐\"的落位感；上缘 40px 接缝阴影 是两屏物理接触的证据。连推三章且底色饱和度拉满，换章本身就成了全片 的节拍器——slack 原片全片就靠这一招做骨架。",
    "use": "多章节产品片的换章骨架（每章一个卖点一种底色）；需要\"翻页节奏感\"贯穿全片的段落切换",
    "frames": 140,
    "holdFrame": 139,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-bubble-swarm-takeover",
    "card": "bubble-swarm-takeover",
    "style": "bubble-swarm-takeover",
    "name": "气泡群幕布",
    "category": "transition",
    "description": "珠光气泡群幕布转场——大小不一的气泡从画外飘入越涨越大遮满整屏，页面同步\"洗白\"，遮蔽峰值处藏切换，气泡向外散开后已是新场景；可混入 i18n 文字胶囊变体",
    "intention": "transition-hidden-cut 的前景遮挡式是\"一件东西扫过去的 1–3 帧\"， wipe-transitions 是一条几何边界扫过——都是\"边界\"思维。本卡是\"幕布\" 思维：让一**群**品牌实体花 2 秒飘入前景涨大遮屏，遮蔽峰值藏硬切， 再散开露出新场景。比几何擦除高级的地方在于幕布本身就是品牌资产， 转场时间越长品牌露出越足，反而不嫌慢。命门有二：**峰值必须真遮满** （6 颗巨型气泡按网格钉落点兜底，随机群只管氛围）；**洗白层压在页面 与气泡之间**——页面先被洗掉细节，气泡才接得住全部视线，切换在白纱 后面完成，观众无从对比前后帧。",
    "use": "章节级换景且品牌世界里有\"实体装饰物\"可当幕布（气泡/花瓣/图标皆可换皮）；转场即品牌露出的段落",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Hallo!"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "¡Hola!"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Ciao!"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-card-flip-reveal",
    "card": "card-flip-reveal",
    "style": "card-flip-reveal",
    "name": "卡片翻面揭示",
    "category": "transition",
    "description": "功能卡 3D 翻面揭示——卡片沿 Y 轴翻 180°，正面 UI 翻到侧棱最薄处闪过一道随角度移动的高光带，背面揭出大号结论数字，逐张错峰扫过整排",
    "intention": "库内\"翻\"字辈已有 wall-reveal-moves B（整墙波浪翻面，讲入场）和 split-flap（字符翻牌，讲文字）。本卡是**语义翻面**：一张卡的正反两面 是一对因果——正面是功能界面，背面是它带来的数字结论。翻面动作本身 就是\"所以呢？\"的回答，Apple bento 段落的标准语法。逐张错峰 10f 扫过 一排，三张卡三个数字节奏读作\"成果连报\"。",
    "use": "\"功能→成果\"的成对叙事：一排功能卡逐张翻出各自的指标/结论；元素级转场卡",
    "frames": 145,
    "holdFrame": 144,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CARD FLIP REVEAL"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "4.9×"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "−38%"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "99.9%"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-card-flock-tumble",
    "card": "card-flock-tumble",
    "style": "card-flock-tumble",
    "name": "卡片翻飞收束",
    "category": "transition",
    "description": "三张 UI 页卡从侧棱薄边 3D 翻飞成阶梯站定（全程清晰、样条连续丝滑），站定后保持慢转不停，快速收束吸入中心，炸出单个湍流烟雾环扩散，巨字横贯收场",
    "intention": "三张页卡像被甩出的扑克在 3D 空间翻飞列队，站定亮相后被瞬间 吸入中心，炸出一圈烟雾环，品牌巨字穿环而出——\"能力展示→能量 坍缩→口号爆发\"一气呵成。命门有三：**丝滑**（侧棱→翻飞→站定 一条 Catmull-Rom 样条导数连续，分段插值的顿挫会被读出来）、 **不许停**（站定后保持低角速度慢转到收束，静止段被裁\"不要停住， 保持旋转\"——高潮段没有静帧）、**全程清晰**（motion blur/景深糊 全删，被裁\"不要加模糊效果\"）。",
    "use": "能量高潮段（功能页群→品牌口号的爆点转场）；霓虹暗场调性；\"多页面能力\"收束成一句话的段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "FASTER"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Inbox"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "List view"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Home"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "STRONGER"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-circle-match-iris",
    "card": "circle-match-iris",
    "style": "circle-match-iris",
    "name": "圆心匹配光圈切",
    "category": "transition",
    "description": "圆心匹配光圈切——光圈从页面上圆形元素的圆心炸开，圈内新页的圆形图表接在同一个圆上；匹配剪辑给光圈一个语义锚点",
    "intention": "普通 iris 光圈（词汇表原条目）从任意点开圈，观众只读到\"换页了\"。 本卡把它和 match-cut 焊死：光圈必须从前景一个**真实圆形元素**的圆心 炸开，圈内长出的新页里有个圆形图表恰好接在同一个圆上——观众看到的 是\"头像的圆变成了图表的圆\"，圆形本身完成叙事（这个人→这个人的数据）。 这是 match-cut 在 UI 语境里的落地形态：不靠构图巧合，靠语义圆对圆。 与穿越三式同属\"后景在前景里预先在场\"，但锚点是抽象形状而非容器。",
    "use": "前景有圆形元素（头像/图标/圆钮）、后景有圆形主体（donut 图/圆环进度）的接缝；转场技法卡",
    "frames": 140,
    "holdFrame": 139,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-color-block-step-wipe",
    "card": "color-block-step-wipe",
    "style": "color-block-step-wipe",
    "name": "色块阶跃吞屏",
    "category": "transition",
    "description": "离散阶跃色块吞屏两式——A 中央小条按 3–5 步硬跳阶跃扩成全屏（接管后徽章两跳弹出），B 色块从角落斜向 3 步吃屏并携带一张页面卡逐跳前进",
    "intention": "库里 wipe 类全是连续扫过——边界匀速或缓动地推过去。本卡反着来： **全程零插值零缓动**，色块像老式像素游戏的方块生长，每一跳都是硬切， 跳与跳之间完全静止。顿挫本身就是节奏：3–5 声\"咔、咔、咔\"比一次 平滑扫过更有宣告感。变体 B 再加一层：色块推进时携带一张内容卡同拍 离散跳位——卡不做补间，读作\"整块被搬进来\"，色块是运货的不是装饰的。",
    "use": "品牌色转场/章节交接；\"硬朗无缓动\"的像素游戏手感段落；接管后的纯色场当下一段的舞台",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-cube-navigation",
    "card": "cube-navigation",
    "style": "cube-navigation",
    "name": "立方体逐面导航",
    "category": "transition",
    "description": "内容贴满 3D 立方体六面，相机正面特写→拉远等轴看棱角→转面推近交替步进，每面按法线朝向实时算明暗",
    "intention": "把\"切页面\"升维成\"转立方体\"：模块不是并列的 tab 而是同一个实体的六个面，相机在特写（读内容）与等轴（看结构）之间交替，观众始终知道\"我在整体的哪一面\"。空间连续性替代了转场。",
    "use": "多模块产品的\"逐面导航\"陈列：Overview/Metrics/Timeline 等 3–6 个板块的空间化串讲",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "OVERVIEW"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "METRICS"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "TIMELINE"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "ASSETS"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "SETTINGS"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "EXPORT"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-gradient-transition",
    "card": "gradient-transition",
    "style": "gradient-transition",
    "name": "渐变参数变奏",
    "category": "transition",
    "description": "背景在 linear、radial、conic 三类 CSS 渐变间平滑过渡——角度、色标、中心、半径逐参数插值，段间交叉淡化换类型",
    "intention": "渐变不是静态贴图而是可动画的参数集：同类型渐变内部任何参数都能插值出丝滑变化，跨类型则用短交叉淡化衔接。作背景层用，给\"没有主体运动\"的段落一层持续的低速能量。",
    "use": "氛围底/章节底色的连续变奏；给静态排版段落提供\"活着\"的背景层",
    "frames": 180,
    "holdFrame": 179,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-line-carry-transition",
    "card": "line-carry-transition",
    "style": "line-carry-transition",
    "name": "线条接力转场",
    "category": "transition",
    "description": "线条接力横移转场——场景 A 的进度条延伸出画，镜头跟线横移，线在移动中拐角围出场景 B 的卡框，全程无剪切",
    "intention": "转场库三大族（穿越/藏切/体块）都在回答\"场景怎么换\"；本卡的回答是 **根本不换——一条线牵着你走过去**。进度条走满后末端延伸成长线冲出 卡缘，镜头跟着线横移 1920px 进入新世界，线在移动中拐直角围出 B 场景 的卡框，框闭合、内容淡入，从头到尾观众的眼睛没离开过这条线。图形 连续性本身就是转场。与 match-cut 的区别：那是切点两侧形状对位—— 终究还是切；这是连续绘制——**没有切**。线的身份要有叙事逻辑（进度条 \"走完了\"所以延伸出去），无来由的线只是装饰。",
    "use": "两个有图形亲缘的场景之间（进度条→卡框、下划线→图表轴）；一支片子的招牌转场位，Catch Me If You Can 片头的图形接力",
    "frames": 160,
    "holdFrame": 159,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Scene A"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Scene B"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-mosaic-reframe",
    "card": "mosaic-reframe",
    "style": "mosaic-reframe",
    "name": "三段布局重排",
    "category": "transition",
    "description": "12 张瓦片在规则网格、feature mosaic、对角瀑布串三种排版间连续变形，位置宽高各自插值、逐片微错峰，段间留 hold",
    "intention": "让观众看见\"布局本身在思考\"：同样 12 张内容，从整齐档案态（网格）变成有主次的策展态（feature mosaic），再变成有态度的动态态（对角瀑布）。三段排版是三种叙事语气，变形过程即产品能力。",
    "use": "\"同一批内容多种看法\"的陈列转场：作品集/模板库/相册产品的布局能力展示",
    "frames": 180,
    "holdFrame": 179,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-barn-door-split",
    "card": "page-turn-transitions",
    "style": "barn-door-split",
    "name": "双门裂开",
    "category": "transition",
    "description": "整页体块转场两式——cube-rotate 立方体翻转（两页贴盒子相邻面转 90°）与 barn-door-split 对开门裂幕（旧页裂两半滑出、新页迎上）",
    "intention": "shot-transitions 六式和 transition-travel/hidden-cut 都把页面当\"场景\" ——相机在场景间移动。本卡把页面当**实体**：它有厚度、有重量、会翻面 会裂开。体块隐喻的仪式感更强，适合章节级大换页（功能 A 讲完→功能 B） 而非镜头级小交棒。A 立方体是\"空间上并列\"——两页是盒子的两面， 暗示同级关系；B 对开门是\"旧的让位\"——旧页从正中撕开滑走、新页 从底下迎上来，暗示取代关系。按语义选：并列翻篇用 A，新旧交替用 B。",
    "use": "章节级换页：两个并列大段落之间的\"翻篇\"仪式；与 shot-transitions 系（镜头交棒）分工——那是\"航拍机移过去\"，这是\"页面自己是实体\"",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BARN DOOR SPLIT"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-cube-rotate",
    "card": "page-turn-transitions",
    "style": "cube-rotate",
    "name": "立方体旋页",
    "category": "transition",
    "description": "整页体块转场两式——cube-rotate 立方体翻转（两页贴盒子相邻面转 90°）与 barn-door-split 对开门裂幕（旧页裂两半滑出、新页迎上）",
    "intention": "shot-transitions 六式和 transition-travel/hidden-cut 都把页面当\"场景\" ——相机在场景间移动。本卡把页面当**实体**：它有厚度、有重量、会翻面 会裂开。体块隐喻的仪式感更强，适合章节级大换页（功能 A 讲完→功能 B） 而非镜头级小交棒。A 立方体是\"空间上并列\"——两页是盒子的两面， 暗示同级关系；B 对开门是\"旧的让位\"——旧页从正中撕开滑走、新页 从底下迎上来，暗示取代关系。按语义选：并列翻篇用 A，新旧交替用 B。",
    "use": "章节级换页：两个并列大段落之间的\"翻篇\"仪式；与 shot-transitions 系（镜头交棒）分工——那是\"航拍机移过去\"，这是\"页面自己是实体\"",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CUBE ROTATE"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-paper-plane-messenger",
    "card": "paper-plane-messenger",
    "style": "paper-plane-messenger",
    "name": "纸飞机信使",
    "category": "transition",
    "description": "纸飞机信使转场——点击\"发送\"后镜头拉远脱离窗口 A，折纸飞机沿贝塞尔弧线飞出（俯仰跟随切线），镜头伴飞穿过多层视差道具，飞抵窗口 B 门前落定，B 放大接管全屏",
    "intention": "transition-travel 是镜头钻进画面里的既有元素换景；本卡反过来——从 动作里**放出一个语义信使**，让镜头跟着它飞去下一个场景。\"发送\"这个 抽象动作被实体化成折纸飞机，A/B 两窗的空间关系被飞行轨迹真实丈量 过，观众对\"消息去了哪\"有了身体感。命门是 2.5D 相机管线：所有元素 挂在同一世界坐标系上，镜头中心 A→跟飞机→B、变焦拉远再推近，视差 道具按 depth 乘相机位移——重 3D 原片降级成一台\"假三维\"，成本掉一个 量级而纵深感保留。飞机俯仰角跟随弧线切线是\"它在飞\"而非\"它在平移\" 的全部区别。",
    "use": "\"发送/邀请/分享\"动作连接两个人物/场景视角的叙事转场；抽象动作需要一个隐喻实体当转场载具时",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Send ➤"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-ink-bleed-reveal",
    "card": "print-texture-transitions",
    "style": "ink-bleed-reveal",
    "name": "墨渗揭示",
    "category": "transition",
    "description": "印刷质感转场——ink-bleed-reveal 墨渗揭示（须状渗边洇开吃掉旧景）",
    "intention": "转场语言已有交棒（shot-transitions 六式）和穿越（transition-travel） ，都是空间/光学隐喻。本式开第三族：**介质隐喻**——新画面不是\"到来\" 而是\"印染\"出来的，直接调用库内纸墨审美的物理想象：像一滴墨落在 宣纸上洇开吃掉旧景，有机、书写感。天然亲和 paper/ink 调性的片子， 是 light-leak-burn（强调色漏光）之外的另一个\"介质系\"接缝选择。",
    "use": "换景接缝的纸墨审美款；与交棒六式/穿越三式并列的第三族——\"介质显影\"型转场",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BEFORE"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-black-card-transition",
    "card": "shot-transitions",
    "style": "BlackCardTransition",
    "name": "镜头交棒转场 · BlackCardTransition",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Every"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "project,"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "linked"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "to"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "your"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "weekly"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "report."
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Weekly Brief · 2026-W28"
      }
    ],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/wbr-full.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-dark-tunnel-transition",
    "card": "shot-transitions",
    "style": "DarkTunnelTransition",
    "name": "镜头交棒转场 · DarkTunnelTransition",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/wbr-full.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-focus-handoff-transition",
    "card": "shot-transitions",
    "style": "FocusHandoffTransition",
    "name": "镜头交棒转场 · FocusHandoffTransition",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-mask-wipe-real",
    "card": "shot-transitions",
    "style": "MaskWipeReal",
    "name": "镜头交棒转场 · MaskWipeReal",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png",
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-portal-wipe-v2",
    "card": "shot-transitions",
    "style": "PortalWipeV2",
    "name": "镜头交棒转场 · PortalWipeV2",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Scene B"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-whip-brake-real",
    "card": "shot-transitions",
    "style": "WhipBrakeReal",
    "name": "镜头交棒转场 · WhipBrakeReal",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 130,
    "holdFrame": 129,
    "texts": [],
    "imageKeys": [
      "textures/live/card4-hires.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-whip-pan-real",
    "card": "shot-transitions",
    "style": "WhipPanReal",
    "name": "镜头交棒转场 · WhipPanReal",
    "category": "transition",
    "description": "镜头交棒六式——推进流白、穿暗场直航、虚焦接力、黑场字卡、whip-pan 甩镜、mask-wipe 穿窗（含纵深款），按能量落差选型",
    "intention": "库内各镜头卡只管自己的入场和收尾，镜与镜\"怎么接\"一直没有词汇—— 接缝裸切会把逐镜头攒出的电影感一次漏光。公认优秀的发布片 （Linear Releases/Agent，2026-07-11 抽帧逆向）全程没有一次裸切： 换景要么靠深度旅行、要么靠焦点接力、要么靠黑场字卡蓄力。",
    "use": "任何两镜衔接处（技法卡，分镜阶段排完镜头后逐个接缝选一式）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [
      "textures/live/projects-full.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-glitch-displace",
    "card": "tear-streak-transitions",
    "style": "glitch-displace",
    "name": "故障条带错位",
    "category": "transition",
    "description": "撕裂转场——glitch-displace 噪声撕裂（16 横条错位抖动中硬切），数字故障语义的条带级撕裂",
    "intention": "本卡管**条带级撕裂**——页面被切成横条高速运动，但每条内容完整。 这是反复裁决划出的品味分界：碎块系转场三连否（doom-melt 竖条坠落、 pixel-dissolve 方块翻黑、facade-block 砖块翻飞全部淘汰），条带系过关。碎块读作\"页面被破坏\"，条带读作\"页面在高速 运动\"——完整性不破、能量却拉满。横向撕：条带左右错位抖动 + 明暗重影，数字故障的灰阶降维（RGB split 改明暗双重影）。 适用系统故障/瞬间跳变语义。",
    "use": "高能换页：数字故障/断裂语义；页面完整性不破、能量拉满的条带级撕裂",
    "frames": 135,
    "holdFrame": 134,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-invisible-cut",
    "card": "transition-hidden-cut",
    "style": "invisible-cut",
    "name": "前景遮挡隐形切",
    "category": "transition",
    "description": "藏切点转场三式——前景遮挡隐形切、对撞开屏、暖色漏光，硬切藏进遮挡/撞击/光峰的 1-3 帧里，观众看不见剪刀",
    "intention": "与 shot-transitions A 式 flash-cut 同族：flash-cut 用一层白闪盖住硬切， 这三式换了三种\"障眼物\"——扫过的前景卡片（A）、对撞的撞击帧（B）、 爬到顶峰的漏光（C）。共同原理是魔术误导：观众的眼睛被大动作/强光 吸走的那 1-3 帧里完成硬切，回过神来景已经换了，全程\"看不见剪刀\"。 flash-cut 是最素的一款；要方向感选 A，要仪式感选 B，要温度选 C。",
    "use": "两镜衔接处需要\"无痕换景\"或\"仪式感开屏\"时（技法卡，与 shot-transitions 六式同层选型）",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-light-leak-burn",
    "card": "transition-hidden-cut",
    "style": "light-leak-burn",
    "name": "琥珀漏光烧切",
    "category": "transition",
    "description": "藏切点转场三式——前景遮挡隐形切、对撞开屏、暖色漏光，硬切藏进遮挡/撞击/光峰的 1-3 帧里，观众看不见剪刀",
    "intention": "与 shot-transitions A 式 flash-cut 同族：flash-cut 用一层白闪盖住硬切， 这三式换了三种\"障眼物\"——扫过的前景卡片（A）、对撞的撞击帧（B）、 爬到顶峰的漏光（C）。共同原理是魔术误导：观众的眼睛被大动作/强光 吸走的那 1-3 帧里完成硬切，回过神来景已经换了，全程\"看不见剪刀\"。 flash-cut 是最素的一款；要方向感选 A，要仪式感选 B，要温度选 C。",
    "use": "两镜衔接处需要\"无痕换景\"或\"仪式感开屏\"时（技法卡，与 shot-transitions 六式同层选型）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Next Page"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-versus-slam",
    "card": "transition-hidden-cut",
    "style": "versus-slam",
    "name": "对撞开屏",
    "category": "transition",
    "description": "藏切点转场三式——前景遮挡隐形切、对撞开屏、暖色漏光，硬切藏进遮挡/撞击/光峰的 1-3 帧里，观众看不见剪刀",
    "intention": "与 shot-transitions A 式 flash-cut 同族：flash-cut 用一层白闪盖住硬切， 这三式换了三种\"障眼物\"——扫过的前景卡片（A）、对撞的撞击帧（B）、 爬到顶峰的漏光（C）。共同原理是魔术误导：观众的眼睛被大动作/强光 吸走的那 1-3 帧里完成硬切，回过神来景已经换了，全程\"看不见剪刀\"。 flash-cut 是最素的一款；要方向感选 A，要仪式感选 B，要温度选 C。",
    "use": "两镜衔接处需要\"无痕换景\"或\"仪式感开屏\"时（技法卡，与 shot-transitions 六式同层选型）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "VS"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-letterform-zoom",
    "card": "transition-travel",
    "style": "letterform-zoom",
    "name": "字腔穿越",
    "category": "transition",
    "description": "穿越式转场两式——共享元素归位、字腔穿越，镜头钻进画面里的真实元素完成换景",
    "intention": "shot-transitions 六式是\"交棒\"型——前镜收尾、后镜入场，接缝靠白闪/暗场/ 焦点/黑场/糊帧/窗口盖住换页瞬间。本卡两式是\"穿越\"型——后景在前景画面里 以真实元素存在（网格槽位/字形洞），镜头一条连续空间运动钻进去， 观众从头到尾跟着同一个物体，没有交棒瞬间。选型口径：后景能在前景里\"预先 在场\"→穿越；两景只是先后关系、无空间嵌套→交棒。两式内部再按语义分—— A 是\"把这张卡放回去\"（详情→总览，F 式穿窗的逆向）；C 是\"标题即是门\" （章节字卡与转场二合一）。",
    "use": "前后两镜存在\"元素/容器\"级空间关系的接缝（技法卡，与 shot-transitions 六式互补选用）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "DASH"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-shared-element-morph",
    "card": "transition-travel",
    "style": "shared-element-morph",
    "name": "共享元素归位",
    "category": "transition",
    "description": "穿越式转场两式——共享元素归位、字腔穿越，镜头钻进画面里的真实元素完成换景",
    "intention": "shot-transitions 六式是\"交棒\"型——前镜收尾、后镜入场，接缝靠白闪/暗场/ 焦点/黑场/糊帧/窗口盖住换页瞬间。本卡两式是\"穿越\"型——后景在前景画面里 以真实元素存在（网格槽位/字形洞），镜头一条连续空间运动钻进去， 观众从头到尾跟着同一个物体，没有交棒瞬间。选型口径：后景能在前景里\"预先 在场\"→穿越；两景只是先后关系、无空间嵌套→交棒。两式内部再按语义分—— A 是\"把这张卡放回去\"（详情→总览，F 式穿窗的逆向）；C 是\"标题即是门\" （章节字卡与转场二合一）。",
    "use": "前后两镜存在\"元素/容器\"级空间关系的接缝（技法卡，与 shot-transitions 六式互补选用）",
    "frames": 130,
    "holdFrame": 129,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-white-flash-logo-simplify-cut",
    "card": "white-flash-logo-simplify-cut",
    "style": "white-flash-logo-simplify-cut",
    "name": "冲白降维切换",
    "category": "transition",
    "description": "彩色液态渐变字标静置流光，画面一拍冲白过曝，白底上扁平版字标淡入定格——一次闪白完成质感降维",
    "intention": "先给足华丽（六色液态渐变在字面上流动、柔光扫掠），再用一次白闪把它\"净化\"成扁平三色字标——观众读到的是\"演出结束，这就是它的正式形象\"。降维是修辞：从感性质感切到理性识别。",
    "use": "品牌段落收束（华丽演绎→干净定妆）；情绪从炫技切换到正式宣告的转场拍",
    "frames": 108,
    "holdFrame": 107,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BRAND"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-blinds-slice",
    "card": "wipe-transitions",
    "style": "blinds-slice",
    "name": "百叶窗切条",
    "category": "transition",
    "description": "几何擦除转场两式——clock-wipe 时钟扫描（雷达指针扫一圈换页）与 blinds-slice 百叶窗切条（12 竖条错峰翻换成波）",
    "intention": "转场库已有三族：穿越系（钻进去）、藏切系（遮住切）、体块系（页面是 实体）。本卡是第四族**几何擦除系**——新旧页都不动，一条几何边界扫过 完成交接，擦除的形状即语义：A 圆扫是\"仪表盘刷新了一屏数据\"，B 条扫 是\"百叶窗逐叶翻面换页\"。与 shot-transitions F 元素遮罩擦除的区别： F 用页面内真实元素当遮罩（依赖构图），本卡是纯几何形——通用性即定位。 按语义选：数据刷新用 A，横向推进翻页用 B。",
    "use": "新旧页都不动、一条几何边界扫过完成交接的通用转场；不依赖构图里有合适元素，哪儿都能用",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-clock-wipe",
    "card": "wipe-transitions",
    "style": "clock-wipe",
    "name": "时钟扫描擦除",
    "category": "transition",
    "description": "几何擦除转场两式——clock-wipe 时钟扫描（雷达指针扫一圈换页）与 blinds-slice 百叶窗切条（12 竖条错峰翻换成波）",
    "intention": "转场库已有三族：穿越系（钻进去）、藏切系（遮住切）、体块系（页面是 实体）。本卡是第四族**几何擦除系**——新旧页都不动，一条几何边界扫过 完成交接，擦除的形状即语义：A 圆扫是\"仪表盘刷新了一屏数据\"，B 条扫 是\"百叶窗逐叶翻面换页\"。与 shot-transitions F 元素遮罩擦除的区别： F 用页面内真实元素当遮罩（依赖构图），本卡是纯几何形——通用性即定位。 按语义选：数据刷新用 A，横向推进翻页用 B。",
    "use": "新旧页都不动、一条几何边界扫过完成交接的通用转场；不依赖构图里有合适元素，哪儿都能用",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-brace-expand",
    "card": "brace-expand",
    "style": "brace-expand",
    "name": "括号拉幕",
    "category": "typography",
    "description": "一对花括号先小字号出现在正中，随即带过冲向左右滑到 ±148px 并放大到标题级，文字 clip 宽度严格绑括号间距、像被拉开幕布般揭示，落定后字距再细微松弛",
    "intention": "标题揭示的手法里，本卡最省：不做遮罩条、不做逐字、不做位移——只让 一对括号往两边走，文字被\"括出来\"。它天生带代码语感（`{}` 是花括号）， 所以在技术产品语境里读作\"这就是内容本体\"。命门是 clip 宽度**必须严格 绑括号位置**：一旦文字自己淡入或自己擦入，括号就退化成装饰，幕布感全失。",
    "use": "开发者/技术产品的标题字卡；章节开场；需要\"一个符号完成揭示\"的极简一拍",
    "frames": 114,
    "holdFrame": 113,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Your title"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-brand-ink-open",
    "card": "brand-ink-open",
    "style": "brand-ink-open",
    "name": "品牌墨印开场",
    "category": "opening",
    "description": "墨线十字准星描画→字标逐字压印→打字机副标→满一秒静止再上浮消散",
    "intention": "第一拍先给品牌记忆点：观众在任何产品画面出现之前，先看清并记住名字。安静、纸墨质感、有一个完整的静止时刻。",
    "use": "品牌开场；任何\"先立名号再进产品\"的片头",
    "frames": 104,
    "holdFrame": 103,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "AI Foundation Lab"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cel-flash-stomp",
    "card": "cel-flash-stomp",
    "style": "cel-flash-stomp",
    "name": "底色闪砸字",
    "category": "typography",
    "description": "底色闪砸字——大词逐拍像图章歪着砸满屏，每词落定瞬间背景层在两个纯色间频闪数帧而文字纹丝不动；动漫必杀技字卡的 UI 翻译",
    "intention": "逐词砸字（stomp typography）单用只有重量；背景纯色闪（动漫背景 フラッシュ——必杀技名出现时底色交替闪）单用只是闪。焊在一起互补 成立：词砸下的落定帧正是底闪的起爆帧，**主体稳、背景闪**——观众 盯着字，眼角余光里整个世界在震颤，打击感来自周边视野而不来自主体 抖动。这是与震屏完全相反的路线：震屏晃主体，本卡晃世界。三词逐拍 递进，末词闪加倍+标签条收束，一句口号剪成三记盖章。",
    "use": "口号/三连词的高能段落（\"SHIP / FASTER / TODAY\"式）；文字节奏卡，与 type-rhythm-sync 互补（那是字属性动，这是字砸+底闪）",
    "frames": 144,
    "holdFrame": 143,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SHIP"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FASTER"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "TODAY"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "CEL FLASH STOMP"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-countdown-arc-scatter",
    "card": "countdown-arc-scatter",
    "style": "countdown-arc-scatter",
    "name": "表盘数字扫过",
    "category": "typography",
    "description": "白底表盘 9 个等大数字沿大弧切向排布，整盘扫过 96° 后减速急停，\"5\" 停在弧顶随即平移落位成标题首字符，其余数字带 blur 原地散去，标题逐词模糊淡入、末词转强调色",
    "intention": "\"5 分钟装完\"写成静态字卡没人信。表盘扫过的做法把这个数字放进一个 **量程**里：45、35、28、22、17、10 一路扫过去，停在 5——观众看到的是 \"从很多降到很少\"，数字自带论证。停下后 \"5\" 不消失而是**平移变成标题的 首字符**，一个元素完成从仪表到文案的身份切换，这是本卡最值钱的一手。",
    "use": "倒计时/时长承诺类文案（\"5 min to install\"）；数据揭晓的一拍；需要\"仪表盘\"语汇的浅底短镜",
    "frames": 33,
    "holdFrame": 32,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "min"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "to"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "install"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-flying-words",
    "card": "flying-words",
    "style": "flying-words",
    "name": "词语纵深隧道",
    "category": "typography",
    "description": "22 个关键词按黄金角铺在扁椭圆截面上，沿 z 轴从 -1750px 飞到相机前 800px 擦身而过，透明度走 [0,1,0.5,0.2,0] 生命曲线，跑满 2 整圈首尾无缝",
    "intention": "关键词列举最土的做法是堆一屏静态词云。词语隧道把同一批词**摊到时间轴上**： 远处生成、由小变大、擦过镜头消失，观众永远只在读三五个词，但主观感受是 \"词很多\"。它是背景层不是主角层——相机不动、元素动，所以前景压一层标题 或 UI 完全不打架。词表整体替换成项目关键词即可，不改一行运动逻辑。",
    "use": "关键词云/能力清单的动态背景；片头片尾的\"信息量\"垫底层；需要纵深穿越感的转场",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Motion"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Layout"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Camera"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Stagger"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Easing"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Beat"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Keyframe"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Blur"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Scale"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "Transform"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "Rotate"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "Parallax"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "Opacity"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "Depth"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "Tween"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "Loop"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "Spring"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "Delay"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "Fade"
      },
      {
        "key": "copy19",
        "label": "文字 20",
        "default": "Composite"
      },
      {
        "key": "copy20",
        "label": "文字 21",
        "default": "Grid"
      },
      {
        "key": "copy21",
        "label": "文字 22",
        "default": "Pivot"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-glitch-cycle",
    "card": "glitch-cycle",
    "style": "glitch-cycle",
    "name": "乱码轮播",
    "category": "typography",
    "description": "同一行等宽槽位循环轮播 4 条状态短语，每条头尾按概率关键帧 [1,0,0,0.1,0,0,1] 全乱码、中段偶发单字抖动，切换瞬间叠 RGB 分离与整行位移；末条概率收 0 保证收尾干净",
    "intention": "状态播报最笨的做法是四行字逐条淡入。轮播把它们压进**一个槽位**： 短语头尾用乱码\"熔断\"再\"凝固\"，中段几乎干净只偶尔抽一下——观众读到的 是\"系统在一步步推进\"，而不是四条独立文案。乱码浓度是这卡的语法： 浓 = 正在切换，淡 = 正在这一状态里。底部进度条把四拍串成一条时间线， 最后一条把概率收到 0，落定即结束。",
    "use": "加载/构建/部署过程的状态播报；技术型片头的\"系统自述\"；需要机器口吻推进时间的一段垫底",
    "frames": 168,
    "holdFrame": 167,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "INITIALIZING"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "LOADING ASSETS"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "COMPILING SHADERS"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "READY TO SHIP"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-gradient-word-sweep",
    "card": "gradient-word-sweep",
    "style": "gradient-word-sweep",
    "name": "渐变充能词",
    "category": "typography",
    "description": "黑底标语里关键词被渐变彩光从左到右快速扫过\"充能\"——波前字符辉光最强向后衰减，填满后字符间勾连细紫红闪电、整词稳态泛光呼吸",
    "intention": "整句白字里只有关键词被\"通电\"：渐变彩光从左到右快速扫过字符， 像能量注入——扫过的瞬间最亮（波前尾迹），随后衰减到稳态； 填满后字符之间跳起勾连的细闪电，词保持泛光呼吸。三个命门： **快**（扫充 15–20f，慢了读作进度条）、**波前最亮**（刚点亮的 字符效果最强，没有这个梯度就是静态渐变裁切）、**辉光克制** （AE 式多层泛光但别糊成一团，闪电细而稀疏才是点缀）。",
    "use": "标语里给单个动词/卖点词充能（Supercharged/faster/AI…）；能量高潮段的文字戏；黑场品牌片的口号帧",
    "frames": 120,
    "holdFrame": 119,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Supercharged"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "performance"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "with rock-solid reliability"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-lead-word-zoom-assemble",
    "card": "lead-word-zoom-assemble",
    "style": "lead-word-zoom-assemble",
    "name": "首词推近组句",
    "category": "typography",
    "description": "首词以 2.3 倍字号占据画面中央、hold 期间继续推近 6%，随后一条曲线同时完成「缩回终字号」与「整行左滑归位」，后续词各自从槽位右侧 0.5em 被推进来；支点横向钉首词中心、纵向钉基线（挂载时实测），整行上移的同一时窗副行浮出，停一拍后整幕 crash-zoom 推近失焦交棒",
    "intention": "字卡最容易犯的错是\"整句一起淡入\"——观众同时收到 5 个词，一个都没记住。这张卡把 阅读顺序做成**物理顺序**：先只给一个词，而且大到占满画面、还在继续朝观众推近，观众 被迫先读它；然后这个词退回自己在句子里的尺寸和位置，整句围绕它长出来。落定时观众 已经读过两遍主词。 真正的手感命门不是缩放曲线，而是**支点**。首词从\"画面正中\"走到\"行内第三个字符的 位置\"，如果支点取行盒中心，缩放和左滑会各自把字往两边拽，末尾几帧基线抖得肉眼可见。 把 `transform-origin` 横向钉在首词中心、纵向钉在基线，这两点全程不动，整行就只是 \"收小\"，没有任何漂移。",
    "use": "品牌名/产品名的 Introducing 字卡；发布会式开场第二镜；一句话主张需要\"先让一个词占满画面、再把整句补齐\"的场合",
    "frames": 84,
    "holdFrame": 83,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Introducing Lumen Deck"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Lumen"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "One shot card, one motion recipe — copy, paste, render."
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-marker-underline-title",
    "card": "marker-underline-title",
    "style": "marker-underline-title",
    "name": "马克笔下划线",
    "category": "typography",
    "description": "大标题落定后，关键词下方马克笔下划线从左到右快速描画——变宽笔形、毛糙边缘、微上斜跟随斜体字势，贴着字底",
    "intention": "打印体标题里突然出现一笔手绘马克笔，用材质反差把一个词从 排版里拎出来——像人拿笔在海报上圈重点。命门有三：**快** （8–12f 一笔呵成，慢了读作加载条）、**近**（贴着字底，离远了 读作分隔线不是强调）、**跟字势**（斜体词的划线必须左低右高 微上斜——斜向画反是最容易犯且一眼假的错，判例见已知坑）。",
    "use": "标题里强调单个关键词（new/free/AI…）；手写感/人味的品牌调性；正文标注式强调",
    "frames": 60,
    "holdFrame": 59,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Meet the"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "new"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Notion AI"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-outline-word-fill",
    "card": "outline-word-fill",
    "style": "outline-word-fill",
    "name": "空心字点亮",
    "category": "typography",
    "description": "空心词（1px 灰描边、500 字重）从 3.2 倍急缓收缩落位，虚线大圆随后从 2.8 倍收到字周围并缓慢自转，左右水平虚线从画框边缘内伸；描边先微微增亮，实心白在 0.6 帧内瞬间点亮，一闪辉光即定格",
    "intention": "一个词要打成钉子，靠的不是慢慢淡入而是**两次落定**：先是巨大空心字 急速收缩到位（这是尺寸的落定），再是描边在一帧内变实心白（这是质感的 落定）。中间那 1.5s 的虚线圆收缩与水平虚线内伸是\"瞄准\"过程——技术 制图语汇，让点亮那一下读作\"确认\"。填充**必须是瞬时**的：慢扫填充会把 钉子变成缓慢的美化动画。",
    "use": "单词式利益点/口号的重锤一拍；节奏卡点上的\"钉子\"镜；深底品牌片的强调帧",
    "frames": 75,
    "holdFrame": 74,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Faster"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-paper-title-card",
    "card": "paper-title-card",
    "style": "paper-title-card",
    "name": "纸张标题卡",
    "category": "typography",
    "description": "一句话逐词压印上纸、一个词标强调色斜体、短划线收束",
    "intention": "在两段产品画面之间给观众一句话的喘息：说清\"接下来看什么、它值什么\"。letterpress 压印质感让字卡与纸墨风格的产品画面同属一个世界。",
    "use": "章节转场/价值主张字卡；重要功能出场前的引导卡；全片呼吸位",
    "frames": 55,
    "holdFrame": 54,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "All"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "your"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "team’s"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "research,"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "one"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "place"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "to"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "go."
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "0123456789"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-pill-chip-slot-cycle-handled",
    "card": "pill-chip-slot-cycle-handled",
    "style": "pill-chip-slot-cycle-handled",
    "name": "胶囊滚轮挤开",
    "category": "typography",
    "description": "白底句式 \"Your `chip` Handled\" 里深色胶囊内词竖向滚轮轮换，胶囊宽度按预量文本宽插值平滑伸缩、两侧文字被自然挤开收拢，胶囊上下露出 13% 透明度的灰色幽灵项",
    "intention": "词槽轮换有两派：让句子躲开变化（宽度固定的滚轮），或者让句子**接受** 变化（胶囊撑宽、两侧文字被挤开）。这卡是后者，代价是必须把宽度算准， 回报是句子读起来活的——\"Your\" 和 \"Handled\" 被推着走，观众感到胶囊里 的词有分量。上下露出的灰色幽灵项是第二个记号：它明示\"这是个可以滚的 列表\"，让观众预期还有下一个词。",
    "use": "\"我们替你搞定 ___\" 这类句式卖点；SaaS 功能列举的一句话收口；浅底品牌片主视觉一拍",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Your"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Handled"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-pill-slot-cycle",
    "card": "pill-slot-cycle",
    "style": "pill-slot-cycle",
    "name": "词槽轮换",
    "category": "typography",
    "description": "句中词槽轮换——固定句干钉死不动，句尾 pill 徽章每 ~0.7s 老虎机滚一格（旧的上飞加速淡出、新的从下带模糊滑入），连换 N 个功能词后落成完整句子收束",
    "intention": "罗列六个功能，列表要六行、逐条淡入要六拍还占满屏。词槽轮换把它们 塞进**一句话的一个槽位**里：句干 \"One AI tool to ___\" 是承诺，槽里 滚过的每个 pill 是证据，最后 pill 飞走、\"do it all.\" 落位——证据 列举完毕，结论盖章。结构自带三幕：承诺→列举→收束。命门是句干 **纹丝不动**：观众的眼睛全程钉在槽位上，句干一晃列举感就散。",
    "use": "\"功能列举\"类文案的最优雅解法（比逐条列表快、比乱码解码有语义）；一句话卖点 + 多个动词短语的段落",
    "frames": 175,
    "holdFrame": 174,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Ask a question"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Find in Drive"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Find in Slack"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Summarize"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Improve writing"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Draft an agenda"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "do it all."
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "One AI tool to"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-scramble",
    "card": "scramble",
    "style": "scramble",
    "name": "乱码锁定",
    "category": "typography",
    "description": "等宽整行字符先每 2 帧高速跳乱码，再从左到右逐个锁定为真字，锁定瞬间蓝白高光闪一下——种子驱动可复现的解密感",
    "intention": "同一句标题的三种\"造字\"手法里，打字机是人在写、翻牌是机器在播报， 乱码锁定是**机器在算**——先满屏噪声表示\"还没解出来\"，再左→右一个个 咬定真字符。它天然带黑客/解密腔，适合技术产品的开场；但也最挑文案： 字符是被逐个点名的，字数就是节拍数。",
    "use": "技术型开场标题；版本号/代号揭晓；\"系统就绪\"\"数据解锁\"这类带机器口吻的一拍",
    "frames": 96,
    "holdFrame": 95,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "TEMPLATE MOTION DEMO"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-split-flap-flip",
    "card": "split-flap-title",
    "style": "split-flap-title",
    "name": "翻牌屏标题",
    "category": "typography",
    "description": "机场翻牌屏字标题——每字符上下两半机械翻牌格，翻过 2 个乱码咔哒停在目标字，左→右级联成波",
    "intention": "文字三式的第三式：压印（paper-title-card）是纸上落墨的\"低语\"，打字机 （document-typewriter-reveal）是文档被人写出来的\"叙述\"，翻牌是车站大屏的 \"播报\"——带机械宣告腔。选翻牌的语境：倒计时/发车感（版本发布、截止日）、 数据播报感（指标揭晓）、或想给标题一层复古机械质感。它天然是等宽深底 格子，在库内纸墨审美里读作\"纸面上摆了一块机械显示屏\"——异色块本身 就是看点，背景产品画面压暗降饱和给它让位。",
    "use": "开场/章节大标题；倒计时、发布日期、数据播报类文案；需要\"机械宣告感\"的一拍",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SHIP FASTER"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-text-column-converge",
    "card": "text-column-converge",
    "style": "text-column-converge",
    "name": "双词合拢",
    "category": "typography",
    "description": "双词对峙合拢——左\"NEW\"右特性词钉死在等屏边距两侧硬切轮换、全程零收缩，换到最后一词才唯一一次 ease-in-out 滑到居中咬合成短语，下方小字近乎硬切浮现；收尾揭晓型文字卡",
    "intention": "两词分踞左右像目录页对峙，观众以为只是轮换字幕；直到最后一词 停稳才发现左右其实是同一句话的两半——唯一一次连续合拢把整段 轮换追认为\"悬念铺垫\"。命门是**钉死**：轮换期两词位置一像素不动、 左右屏边距完全相等（原片实测 412 vs 413@1280），任何渐进收缩都会 提前剧透合拢、把揭晓稀释成进度条。合拢只许发生一次，且必须在 最后一词之后——这是收尾揭晓，不是持续动效。",
    "use": "特性清单收束到产品名/口号的段落（\"NEW × 一串特性 → NEW <产品名>\"式）；发布会式 recap、版本号揭晓",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "LAUNCHER DESIGN"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "COMPACT MODE"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "HOTKEY RECORDER"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "HOTKEY TYPES"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "VOICE FEATURES"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "SETTINGS DESIGN"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "AI CHAT"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "FILE SEARCH"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "RAYCAST"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "NEW"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "COMING 2026"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-title-demote-to-label",
    "card": "title-demote-to-label",
    "style": "title-demote-to-label",
    "name": "标题降格标签",
    "category": "typography",
    "description": "大标题降格为节标签两式——A 大标题居中显影站稳一拍后连续缩小 0.3x 平移到左上角落成小节标签、内容区在其下生长；B 同套路但登场时带文本选中态高亮块扫入再撤掉",
    "intention": "章节标题的常规命运是\"出现→消失→内容登场\"，标题和内容互不认识。 本卡让标题**降格而不退场**：居中大字站稳一拍宣告主题，然后一次连续 补间缩到 0.3x 飞到左上角，落成这一节的栏目标签——它还在屏幕上， 只是从主角变成了门牌。观众获得免费的空间记忆：刚才那个大词就是 现在左上角那个小词，本节讲的就是它。内容骨架在降格进行中就开始 生长，交接零空档。",
    "use": "章节开场（标题先当主角再让位给内容）；教程/功能演示片的小节交接；B 式给\"文字/编辑\"类产品加身份暗示",
    "frames": 196,
    "holdFrame": 195,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Running Subagents"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Select the Answer"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-letterform-drift-assembly",
    "card": "type-assembly-moves",
    "style": "LetterformDriftAssembly",
    "name": "文字集结 · LetterformDriftAssembly",
    "category": "typography",
    "description": "文字集结四式——split-text-stagger 逐字裂升、letterform-drift-assembly 漂移合拢、tracking-expand-reveal 字距呼吸、text-on-path 沿线流入",
    "intention": "标题入场已有\"原位变形系\"四式（乱码解码/字符坠落/翻牌/打字机——字 在原地换形态）。本卡补\"集结系\"：字符从别处**汇聚成**标题，运动轨迹 本身有戏。A 琴键式——每字从看不见的裁切线下滑升，理性利落，通用度 最高；B 片头式——字符四散带模糊漂入、逐个锁定加深，Stranger Things 的仪式感，适合品牌名亮相;C 呼吸式——字母从叠压一团吸一口气展开， 最安静的一式，适合抒情段落；D 语义式——字符沿一条上升曲线鱼贯流入 再摆正，曲线可以正好描着图表增长线走，文字与数据同框叙事。",
    "use": "大标题/标语的入场；与 type-entrance-moves 两式、split-flap-title、document-typewriter-reveal 同属标题入场大品类，全片 ≤2 种",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "ASSEMBLE"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "LETTERFORM DRIFT ASSEMBLY"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-split-text-stagger",
    "card": "type-assembly-moves",
    "style": "split-text-stagger",
    "name": "逐字裂升",
    "category": "typography",
    "description": "文字集结四式——split-text-stagger 逐字裂升、letterform-drift-assembly 漂移合拢、tracking-expand-reveal 字距呼吸、text-on-path 沿线流入",
    "intention": "标题入场已有\"原位变形系\"四式（乱码解码/字符坠落/翻牌/打字机——字 在原地换形态）。本卡补\"集结系\"：字符从别处**汇聚成**标题，运动轨迹 本身有戏。A 琴键式——每字从看不见的裁切线下滑升，理性利落，通用度 最高；B 片头式——字符四散带模糊漂入、逐个锁定加深，Stranger Things 的仪式感，适合品牌名亮相;C 呼吸式——字母从叠压一团吸一口气展开， 最安静的一式，适合抒情段落；D 语义式——字符沿一条上升曲线鱼贯流入 再摆正，曲线可以正好描着图表增长线走，文字与数据同框叙事。",
    "use": "大标题/标语的入场；与 type-entrance-moves 两式、split-flap-title、document-typewriter-reveal 同属标题入场大品类，全片 ≤2 种",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "MOTION SYSTEM"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "SPLIT TEXT STAGGER"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-text-on-path",
    "card": "type-assembly-moves",
    "style": "text-on-path",
    "name": "沿线流入",
    "category": "typography",
    "description": "文字集结四式——split-text-stagger 逐字裂升、letterform-drift-assembly 漂移合拢、tracking-expand-reveal 字距呼吸、text-on-path 沿线流入",
    "intention": "标题入场已有\"原位变形系\"四式（乱码解码/字符坠落/翻牌/打字机——字 在原地换形态）。本卡补\"集结系\"：字符从别处**汇聚成**标题，运动轨迹 本身有戏。A 琴键式——每字从看不见的裁切线下滑升，理性利落，通用度 最高；B 片头式——字符四散带模糊漂入、逐个锁定加深，Stranger Things 的仪式感，适合品牌名亮相;C 呼吸式——字母从叠压一团吸一口气展开， 最安静的一式，适合抒情段落；D 语义式——字符沿一条上升曲线鱼贯流入 再摆正，曲线可以正好描着图表增长线走，文字与数据同框叙事。",
    "use": "大标题/标语的入场；与 type-entrance-moves 两式、split-flap-title、document-typewriter-reveal 同属标题入场大品类，全片 ≤2 种",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "GROWTH ALL THE WAY"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "TEXT ON PATH"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-tracking-expand-reveal",
    "card": "type-assembly-moves",
    "style": "TrackingExpandReveal",
    "name": "文字集结 · TrackingExpandReveal",
    "category": "typography",
    "description": "文字集结四式——split-text-stagger 逐字裂升、letterform-drift-assembly 漂移合拢、tracking-expand-reveal 字距呼吸、text-on-path 沿线流入",
    "intention": "标题入场已有\"原位变形系\"四式（乱码解码/字符坠落/翻牌/打字机——字 在原地换形态）。本卡补\"集结系\"：字符从别处**汇聚成**标题，运动轨迹 本身有戏。A 琴键式——每字从看不见的裁切线下滑升，理性利落，通用度 最高；B 片头式——字符四散带模糊漂入、逐个锁定加深，Stranger Things 的仪式感，适合品牌名亮相;C 呼吸式——字母从叠压一团吸一口气展开， 最安静的一式，适合抒情段落；D 语义式——字符沿一条上升曲线鱼贯流入 再摆正，曲线可以正好描着图表增长线走，文字与数据同框叙事。",
    "use": "大标题/标语的入场；与 type-entrance-moves 两式、split-flap-title、document-typewriter-reveal 同属标题入场大品类，全片 ≤2 种",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "BREATHE"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "TRACKING EXPAND REVEAL"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "A CINEMATIC TITLE ENTRANCE"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-letter-drop-physics",
    "card": "type-entrance-moves",
    "style": "letter-drop-physics",
    "name": "字符坠落",
    "category": "typography",
    "description": "标题文字入场两式——scramble-decode 乱码解码（噪声里长出答案）与 letter-drop-physics 字符坠落（重力砸落弹跳归位），按调性二选一",
    "intention": "标题入场库内已有打字机（沉稳文档感）和翻牌屏（机械仪式感），这两式补 另外两种性格：A 是终端黑客感——字符先是一片高速噪声，从左到右逐个 \"解码\"锁定，观众看着答案从乱码里长出来，适合技术产品的自信亮相； B 是物理喜剧感——字符从天而降、砸地弹跳、歪歪扭扭站定，最后一拍 集体立正归位，适合轻松调性的开场破冰。四种标题入场同片 ≤2 种（P4）。",
    "use": "大标题/章节字卡的入场；与 split-flap-title（机械翻牌）、document-typewriter-reveal（打字机）同品类互斥选用",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "GRAVITY"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-scramble-decode",
    "card": "type-entrance-moves",
    "style": "scramble-decode",
    "name": "乱码解码",
    "category": "typography",
    "description": "标题文字入场两式——scramble-decode 乱码解码（噪声里长出答案）与 letter-drop-physics 字符坠落（重力砸落弹跳归位），按调性二选一",
    "intention": "标题入场库内已有打字机（沉稳文档感）和翻牌屏（机械仪式感），这两式补 另外两种性格：A 是终端黑客感——字符先是一片高速噪声，从左到右逐个 \"解码\"锁定，观众看着答案从乱码里长出来，适合技术产品的自信亮相； B 是物理喜剧感——字符从天而降、砸地弹跳、歪歪扭扭站定，最后一拍 集体立正归位，适合轻松调性的开场破冰。四种标题入场同片 ≤2 种（P4）。",
    "use": "大标题/章节字卡的入场；与 split-flap-title（机械翻牌）、document-typewriter-reveal（打字机）同品类互斥选用",
    "frames": 130,
    "holdFrame": 129,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "DECODE SPEED"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-font-weight-pump",
    "card": "type-rhythm-sync",
    "style": "font-weight-pump",
    "name": "字重脉冲",
    "category": "typography",
    "description": "文字随声同步两式——font-weight-pump 字重脉冲（笔画随鼓点变粗弹回）与 karaoke-fill-sync 卡拉OK填色（词随旁白逐个点亮）",
    "intention": "文字动效库内此前全是\"入场怎么进\"，没有词管\"在场的字怎么跟着声音活\"。 这两式补上：A 让标题变成节奏器官——笔画随低音鼓抽动变粗又弹回， 文字在蹦迪，适合高能段落的视觉低音炮；B 让标语变成跟读字幕—— 旁白读到哪个词哪个词从左到右填色点亮，视线被牵着走，适合口播/ 标语强调段。共同点是**字不动、属性动**：无位移、无入退场， 纯粹是字重/颜色在声音的拍点上呼吸。",
    "use": "标题/标语与音轨强绑定的段落；A 绑节拍（鼓点），B 绑语音（旁白逐词）",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "PUMP IT UP"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-karaoke-fill-sync",
    "card": "type-rhythm-sync",
    "style": "karaoke-fill-sync",
    "name": "填色随读",
    "category": "typography",
    "description": "文字随声同步两式——font-weight-pump 字重脉冲（笔画随鼓点变粗弹回）与 karaoke-fill-sync 卡拉OK填色（词随旁白逐个点亮）",
    "intention": "文字动效库内此前全是\"入场怎么进\"，没有词管\"在场的字怎么跟着声音活\"。 这两式补上：A 让标题变成节奏器官——笔画随低音鼓抽动变粗又弹回， 文字在蹦迪，适合高能段落的视觉低音炮；B 让标语变成跟读字幕—— 旁白读到哪个词哪个词从左到右填色点亮，视线被牵着走，适合口播/ 标语强调段。共同点是**字不动、属性动**：无位移、无入退场， 纯粹是字重/颜色在声音的拍点上呼吸。",
    "use": "标题/标语与音轨强绑定的段落；A 绑节拍（鼓点），B 绑语音（旁白逐词）",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SHIP"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "FASTER"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "BREAK"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "NOTHING"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-terminal-typewriter",
    "card": "typewriter-moves",
    "style": "terminal-typewriter",
    "name": "终端打字引爆",
    "category": "typography",
    "description": "打字机两式——terminal-typewriter 终端命令敲完即引爆场景切换、error-retype 误删重打的\"改口\"三幕剧",
    "intention": "打字是唯一自带时间性的文字入场——字符一个个到来本身就是节奏， 不需要额外动效。A 把打字当**引信**：暗色终端窗逐字敲出命令、 方块光标方波闪，回车帧镜头急推进命令行硬切产品界面，命令行是 场景的导火索，开发者产品标配；B 把打字当**独白**：逐字打出平庸词 （\"just a dashboard\"）→ 停顿犹豫 → 退格删掉 → 更快打出卖点词 （\"your command center\"），犹豫-否定-宣言的三幕剧，戏全在三档 速度差里。与 scramble-decode 的区别：乱码解码是机器在猜， 打字是人在说。",
    "use": "开发者产品开场（A）、slogan/卖点字卡（B）；文字自带时间性的入场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "~/acme-app (main)"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-typewriter-error-retype",
    "card": "typewriter-moves",
    "style": "TypewriterErrorRetype",
    "name": "打字机动效 · TypewriterErrorRetype",
    "category": "typography",
    "description": "打字机两式——terminal-typewriter 终端命令敲完即引爆场景切换、error-retype 误删重打的\"改口\"三幕剧",
    "intention": "打字是唯一自带时间性的文字入场——字符一个个到来本身就是节奏， 不需要额外动效。A 把打字当**引信**：暗色终端窗逐字敲出命令、 方块光标方波闪，回车帧镜头急推进命令行硬切产品界面，命令行是 场景的导火索，开发者产品标配；B 把打字当**独白**：逐字打出平庸词 （\"just a dashboard\"）→ 停顿犹豫 → 退格删掉 → 更快打出卖点词 （\"your command center\"），犹豫-否定-宣言的三幕剧，戏全在三档 速度差里。与 scramble-decode 的区别：乱码解码是机器在猜， 打字是人在说。",
    "use": "开发者产品开场（A）、slogan/卖点字卡（B）；文字自带时间性的入场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-typing-code-block",
    "card": "typing-code-block",
    "style": "typing-code-block",
    "name": "代码块揭示",
    "category": "typography",
    "description": "同一段语法高亮代码左右并置两种 reveal——左侧行级 stagger 4f 淡入上浮 8px，右侧逐字符打字但字符保持原 token 色，当前字符垫一块 #3a4468 方块光标",
    "intention": "代码揭示只有两种真解法：**整行浮出来**（读的是结构）和**一个字一个字打** （读的是过程）。这卡把两者并排放在同一段代码上，是选型用的对照镜： 左侧 4 行 4 拍就完，适合\"代码不是重点、结果才是\"；右侧 138 帧才打完 59 个字符，适合\"看我写\"。关键细节是右侧**打字不丢色**——常见错误是 打字时先出白字再着色，那就退化成终端回显，不是代码编辑器。",
    "use": "代码/配置揭示镜头；开发者产品的\"就三行\"演示；需要对比两种揭示节奏时的选型参考镜",
    "frames": 138,
    "holdFrame": 137,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "const "
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "app"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "createApp"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "use"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "router"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "mount"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "'#root'"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "// ready"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "LINE FADE-IN"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "CHAR TYPING"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-vertical-word-roll-blur-cycle",
    "card": "vertical-word-roll-blur-cycle",
    "style": "vertical-word-roll-blur-cycle",
    "name": "竖向词条滚轮",
    "category": "typography",
    "description": "句尾词换成竖向滚轮，3 次换词各 0.55s（outQuint 七成 + outBack 三成，前快后极慢带微过冲），相邻行按距离上垂直 blur 与灰度，中心词落定瞬间从灰染成强调色",
    "intention": "句尾换词的最优解是滚轮而不是淡入淡出：滚轮自带**方向**（往上翻页）， 观众知道\"还有下一个\"。这卡的两个身份记号是相邻行的**垂直 blur** （滚轮景深，模拟机械转筒的失焦）和落定时的**染色**（灰→强调色， \"这个才是答案\"）。句干 `Built for` 全程纹丝不动——眼睛钉在滚轮上， 句干一晃列举感就散。",
    "use": "\"Built for ___\" 这类句干 + 受众/对象列举的一句话卖点；浅底品牌片的干净一拍",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Apps"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Teams"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Data"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Everyone"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Built for"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-word-relay-filmstrip",
    "card": "word-relay-filmstrip",
    "style": "word-relay-filmstrip",
    "name": "胶片词接力",
    "category": "typography",
    "description": "左列黑白相间等高页面卡步进滚动、右侧衬线大词原位接力（名词恒定+动词轮换）——切词瞬间才滚动一格，词块垂直中心与当前页面卡中点精确对齐",
    "intention": "左边是证据（页面截图胶片），右边是论点（大词）：动词换一次， 胶片就步进一格给出新证据——文字与画面互为注脚。命门是**步进制**： 左列平时完全静止，只在切词瞬间滚动一格（滚动=换证据的机械动作）， 持续滚动会让左列沦为背景装饰、切词失去\"咔哒\"感。第二命门是 **对齐**：大词块垂直中心必须与当前页面卡中点精确对齐（像素级）， 歪了整个版式的\"编辑部严谨感\"就塌了。",
    "use": "\"一个主体 × 多种能力\"的枚举段（Computer researches/builds/codes…）；作品集/案例流展示；产品多场景巡礼",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "researches"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "builds"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "codes"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Computer"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-word-relay-geometry",
    "card": "word-relay-geometry",
    "style": "word-relay-geometry",
    "name": "利益词接力",
    "category": "typography",
    "description": "三个利益词各带一套专属几何接力——虚线大圆自转收缩 → 三实线圆 trim 依次生长（相位差 0.06）→ 金属 sheen 扫过后一拍收成纯白；旧词缩到 0.86 淡出，新词描边→填充揭示",
    "intention": "三点式利益陈述最容易做成三张字卡硬切。接力的做法是给每个词配一套 **只属于它的几何**：虚线圆是\"在转\"（快）、三圆相扣是\"互相咬合\"（好）、 金属扫光是\"材质硬\"（强）——几何本身就在替形容词做论证。第三个词 留了升格待遇（sheen 扫光 + 收白），因为它是结论。背景 20 颗微尘上浮 把三拍缝成一个连续空间，不然还是三张卡。",
    "use": "三点式利益陈述（更快/更好/更强）；品牌价值观段落；需要\"一词一世界\"的中段推进",
    "frames": 180,
    "holdFrame": 179,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Faster"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Better"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Stronger"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-avatar-bracket-carousel",
    "card": "avatar-bracket-carousel",
    "style": "avatar-bracket-carousel",
    "name": "对焦框轮换",
    "category": "ui-entrance",
    "description": "\"Your ___ teammates\" 填空排版，四角对焦框钉在句中不动，头像队列在框内垂直 spring 轮换三次，入框放大清晰、出框按距离缩小淡化模糊，角色标签同步更换，切换瞬间对焦框呼吸 7%",
    "intention": "\"我们有设计师、客服、分析师、写手\"列成四行就是一张清单。塞进一句话的一个槽位里， 它变成一个承诺加四次证明：句子不动，只有槽里的人在换。四角对焦框是这个手法的关键 ——它不参与轮换，但它把观众的眼睛钉死在那 92×92 的方框里，所以四次更换才读作 \"同一个位置\"而不是\"四张头像飘过\"。",
    "use": "\"一个位置，多种角色\"的能力枚举；团队/身份/预设/人格类产品的核心一句话镜头",
    "frames": 156,
    "holdFrame": 155,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Your"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "teammates"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-bezier-source-converge-merge",
    "card": "bezier-source-converge-merge",
    "style": "bezier-source-converge-merge",
    "name": "曲线汇流吞并",
    "category": "ui-entrance",
    "description": "左侧四个来源节点各有一条细贝塞尔曲线连向右侧同一汇聚点，曲线先错峰由左向右 draw-on，节点沿自己的曲线滑向汇聚点并三段式加速缩小到消失，强调色数据包全程沿路径滑行，吞并完成后曲线从左端反向擦除只留圆形徽标",
    "intention": "\"我们把四个来源统一了\"是一句抽象话。这个动效把它变成可看的物理过程：先建立四条独立 的通路（draw-on 是\"连上了\"），再让四个来源真的顺着通路走进同一个点并被吸进去（缩小 到 0 是\"被吞并\"），最后擦掉通路只留徽标（\"现在只有一个\"）。三段叙事各自有明确的 起止，观众不需要旁白就能读出因果。",
    "use": "\"多源整合/统一接入/数据汇聚\"的核心机制镜头；集成、聚合、单一入口类产品的说明段落",
    "frames": 168,
    "holdFrame": 167,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "S1"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "S2"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "S3"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "S4"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-carousel3-d",
    "card": "carousel-3d",
    "style": "carousel-3d",
    "name": "环形画廊",
    "category": "ui-entrance",
    "description": "8 张卡按 sin/cos 排成半径 190px 的圆环并匀速整环自转一圈，每卡只绕 Y 公转、自身 billboard 朝外，正反两层同向贴图配 backface-visibility:hidden 保证任何时刻都正立不倒置，相机全程钉在浅俯角近景",
    "intention": "展示\"一组东西\"最省事的办法是排成一排横滑，但横滑有起点和终点。环形没有——它天然 循环，观众看多久都不会觉得\"放完了\"。这张卡真正要解决的是环形 carousel 最容易翻车 的点：卡片背面。方案是双面同向贴图，所以从环内看和从环外看是同一张正立的卡，环转一圈 不会有任何一帧出现镜像或倒置。",
    "use": "作品集/模板库/集成清单的循环展示；需要无缝 loop 的背景拍或落地页 hero",
    "frames": 168,
    "holdFrame": 167,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CARD 0"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-cloner-depth-echo",
    "card": "cloner-depth-echo",
    "style": "cloner-depth-echo",
    "name": "克隆纵深回响",
    "category": "ui-entrance",
    "description": "克隆纵队——主卡瞬间\"复印\"出 7 个半透明分身沿斜向纵深排开成队，停一拍后全体加速吸回本体合一+弹跳",
    "intention": "Spline/C4D Cloner 语汇的 UI 翻译：一张主卡\"啪\"地复印出 7 个克隆体 沿 Z 轴向后等距排开（间隔 120px、透明度 100%→20% 递减），错峰弹出 成纵队；停 ~25f 让观众数得清\"有很多个\"；然后全体 ease-in 加速吸回 本体合一，合体瞬间本体弹 1.08x 收束。与 depth-layer-moves 视差 （不同内容分层）分工：这是**同一内容**的等距重影阵列，语义是规模 不是空间。",
    "use": "\"多副本/多租户/规模感/批量处理\"卖点；一镜讲完\"一个=很多\"",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "CLONER DEPTH ECHO"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-deck-deal-flyin",
    "card": "deck-deal-flyin",
    "style": "deck-deal-flyin",
    "name": "发牌飞入",
    "category": "ui-entrance",
    "description": "暗场金属背景里的实体牌堆特写环绕开局，拉远交给页面后一摞卡像发牌一样硬加速甩进网格，相机追着滚动、满板停半秒",
    "intention": "先给悬念（这一摞是什么？），再给答案（是几十个项目，它们自己飞进页面各就各位）。观众要感受到\"东西源源不断地涌进来\"，每张卡带着急迫感砸到位。",
    "use": "展示\"内容量大/源源不断汇入\"的列表页与卡片墙；建立信息密度的第一印象",
    "frames": 113,
    "holdFrame": 112,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-doc-park-left-pill-deal",
    "card": "doc-park-left-pill-deal",
    "style": "doc-park-left-pill-deal",
    "name": "文档驻留发牌",
    "category": "ui-entrance",
    "description": "文档不淡出而是向左滑出只露约 35% 宽并微缩到 0.92，右侧按旁白节奏慢速发牌三张白底描边药丸（outBack 弹入），每张落定后其下方字幕逐词加深、下一张到来前整句淡出，左侧文档全程极缓慢自动滚动保持\"正在被读\"",
    "intention": "结论要一条一条给，观众才记得住。但如果把来源文档淡出，结论就变成了空中楼阁——观众 不知道这些话从哪来。这张卡的解法是**让来源留在画面里**：文档靠左驻留只露一截，还在 缓慢滚动（说明它正在被读），右侧的每条结论都是从这份文档里长出来的。发牌节奏刻意慢， 是为了给旁白留出说完一句的时间。",
    "use": "旁白驱动的\"分析结论逐条给出\"段落；文档理解、推荐理由、审阅意见类产品的核心说明镜头",
    "frames": 174,
    "holdFrame": 173,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Quick Start"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Bundle Plan"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Starter Kit"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-document-typewriter-reveal",
    "card": "document-typewriter-reveal",
    "style": "document-typewriter-reveal",
    "name": "文档打字揭示",
    "category": "typography",
    "description": "整页真排版文档在光标后自己\"写\"出来、侧栏跟进、历史条目逐个落入轨道",
    "intention": "观众会读清屏幕上每个字——这一镜的说服力全在\"文档是真的\"。打字机式写入把静态页面变成\"正在被写出来的文档\"，侧栏历史条目落入补上\"持续产出\"的时间纵深。",
    "use": "文档/报告/笔记类功能镜头；信息密度最高的一拍",
    "frames": 110,
    "holdFrame": 109,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "2026-W27 · Foundation Lab Weekly"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "2026-W26 · Foundation Lab Weekly"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "2026-W25 · Foundation Lab Weekly"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "2026-W24 · Foundation Lab Weekly"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "2026-W23 · Foundation Lab Weekly"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "2026-W22 · Foundation Lab Weekly"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Weekly Brief · 2026-W28"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-draw-svg-trace",
    "card": "draw-svg-trace",
    "style": "draw-svg-trace",
    "name": "SVG 描线追踪",
    "category": "ui-entrance",
    "description": "描边生长圈注——一条带笔头的墨线沿元素轮廓跑一圈把它\"画\"出来，闭合瞬间闪黑交棒、内容淡入；同套路可给标题画下划线",
    "intention": "\"画出来\"是纸墨审美里最顺手的入场隐喻：元素不是飞进来也不是淡进来， 而是被一支看不见的笔当场描出来。库内 wall-reveal-moves C 式已有整页 蓝图版（全屏线框逐段画+区域点亮），本卡是它的**元素级特写版**—— 一条线、一个主体、一次闭合，笔头可见、方向可读，适合\"接下来讲它\" 的点名时刻。第二用法是标题下划线生长：同一套路 18f 短版，给重点词 一笔手绘强调，与马克笔审美 token 天然同族。",
    "use": "单个卡片/图表/标题的被点名入场；元素级手法（整页级蓝图描线归 wall-reveal-moves C 式）",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "DRAW SVG TRACE"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-axial-stretch",
    "card": "element-body-moves",
    "style": "axial-stretch",
    "name": "轴向拉伸",
    "category": "ui-entrance",
    "description": "元素身体感两式——axial-stretch 轴向拉伸糖稀拉丝、contact-shadow-lift 接触阴影离面抬升",
    "intention": "库内运动卡全在管\"位置在变\"——飞入、滑动、弹跳，元素本身始终是刚体。 这两式管**身体在变**：A 给速度一个可见的肉身——飞得越快沿运动轴拉得 越长，一块糖稀，落点压扁回弹收正，squash & stretch 的 UI 翻译；B 给 悬浮一个可信的证据——卡抬起时正下方阴影同步放大变淡，纸片离桌， staging 法则给 2.5D 运镜垫的物理台词。与 smear-multiples 的区别：那是 可数残像（离散鬼影），A 是连续拉伸（糖稀不断丝）；与 CameraMotionBlur 的区别：快门拖影是相机的事，拉伸是身体的事，同一元素别叠加。",
    "use": "给\"位置在变\"之外补\"身体在变\"：高速飞入给速度肉身（A）、卡片点名给悬浮证据（B）；A 配横冲入场，B 配 2.5D 运镜与逐张点名",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "AXIAL STRETCH"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-contact-shadow-lift",
    "card": "element-body-moves",
    "style": "contact-shadow-lift",
    "name": "接触阴影抬升",
    "category": "ui-entrance",
    "description": "元素身体感两式——axial-stretch 轴向拉伸糖稀拉丝、contact-shadow-lift 接触阴影离面抬升",
    "intention": "库内运动卡全在管\"位置在变\"——飞入、滑动、弹跳，元素本身始终是刚体。 这两式管**身体在变**：A 给速度一个可见的肉身——飞得越快沿运动轴拉得 越长，一块糖稀，落点压扁回弹收正，squash & stretch 的 UI 翻译；B 给 悬浮一个可信的证据——卡抬起时正下方阴影同步放大变淡，纸片离桌， staging 法则给 2.5D 运镜垫的物理台词。与 smear-multiples 的区别：那是 可数残像（离散鬼影），A 是连续拉伸（糖稀不断丝）；与 CameraMotionBlur 的区别：快门拖影是相机的事，拉伸是身体的事，同一元素别叠加。",
    "use": "给\"位置在变\"之外补\"身体在变\"：高速飞入给速度肉身（A）、卡片点名给悬浮证据（B）；A 配横冲入场，B 配 2.5D 运镜与逐张点名",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-floating-glossy-label-pills",
    "card": "floating-glossy-label-pills",
    "style": "floating-glossy-label-pills",
    "name": "高光胶囊横滑",
    "category": "ui-entrance",
    "description": "四块浅灰 dashboard wireframe 面板各顶一枚高光胶囊标签横向排队，轨道三拍向右换位（缓起→中段冲→缓收，首拍更慢带长尾），居中者放大清晰、两侧缩到 0.62 并下沉变淡微模糊形成走廊感，末段黑色描白边光标从右上斜滑到末位胶囊右端静止",
    "intention": "四个功能挨个全屏展示会切四刀，观众每次都要重新定位。走廊式 carousel 只有一个视觉 中心：居中的那块是主角，左右各露一截邻居的边缘告诉观众\"还有更多、这是同一条队列\"。 末段的光标是刻意的：它把叙事从\"系统在自动播放\"交回\"这是一个人在操作\"，为下一拍的 交互镜头做交接。",
    "use": "多功能横向枚举（Feature A–D 各一屏）；产品概览、功能巡览类段落，也可作落地页 hero 的循环底",
    "frames": 120,
    "holdFrame": 119,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-integration-hub-map",
    "card": "integration-hub-map",
    "style": "integration-hub-map",
    "name": "集成星图",
    "category": "ui-entrance",
    "description": "旧页面一次性快翻 180°（侧棱瞬间亮闪）落成新中枢页，五个集成 app 图标同帧弹现、随即五条彩虹光管同帧齐连，光管内输送脉冲持续流动——\"翻开新一页，生态一齐接入\"",
    "intention": "翻面是\"换时代\"：旧文档页整个翻转 180° 得到新中枢页——必须是 完整翻面不是转个角度（判例），翻的动作**快翻+尾段减速**、一口气 完成无分段停顿（\"匀速\"判例：用户说的匀速=无停顿，不是字面 linear；90° 侧棱停顿版被裁）。侧棱时刻只\"闪一下\"（1–3f 脉冲， 长光晕平台被裁）。接入是**两拍制**：五图标同帧弹现（第一拍）→ 五管同帧起画齐连（第二拍）——齐，才读作\"生态一次到位\"；错峰 逐个连读作逐个谈判（两轮被裁）。连通后光管内亮脉冲沿图标→中枢 方向持续循环，\"输送感\"是终态的生命。",
    "use": "集成/生态能力段（一个产品连一切）；版本翻新叙事（旧页翻成新页）；暗场霓虹调性的功能高潮",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Q3 Enterprise Deal"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Revenue · Pipeline · Q3 Quota"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Major Enterprise Account - UK"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Revenue · MQL · International"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Enterprise Pitch Deck"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Open in GDrive"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "MQL Lead Form Design"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Figma File · Last Edited"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Enterprise Sales"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "ClickUp Space"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "Enterprise Closed Archive"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "Archived · In Enterprise Sales"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "Open Enterprise Lead - Follow up"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "In Progress · In Enterprise Sales · Yesterday"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "Enterprise MQLs"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "Recent"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "+ Add Location Filter"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "QUICK FILTERS"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "TASK FILTERS"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-list-reveal",
    "card": "list-reveal",
    "style": "list-reveal",
    "name": "逐项找位",
    "category": "ui-entrance",
    "description": "垂直菜单 6 项按 0.09 的间隔依次 scale 找位、outBack 轻微过冲落定，同时整个列表容器全程线性上移 32px——逐项入场与整体漂移是两层不相干的运动",
    "intention": "列表逐项淡入是最容易做得死板的一类动效：每项动完就停，画面在两项之间是完全静止的。 这张卡的解法是给容器加一层与逐项入场无关的慢速漂移——局部在\"找位\"，整体在\"呼吸\"。 观众读得清每一项，同时画面从头到尾没有一帧是钉死的。",
    "use": "导航/侧边栏/设置面板的入场；任何\"界面自己长出来\"的 UI 段落，也适合做旁白铺垫时的低能量底",
    "frames": 108,
    "holdFrame": 107,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Dashboard"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Projects"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Analytics"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Messages"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Settings"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Sign out"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-list-stack-press",
    "card": "list-stack-press",
    "style": "list-stack-press",
    "name": "列表堆叠压弹",
    "category": "ui-entrance",
    "description": "列表卡从画面底部逐张飞上摞起，每张落地压弹整摞、计数器同步跳一格",
    "intention": "\"堆叠有重量\"：每张新卡落上来，已落定的整摞被压下再弹回——观众从物理反馈里读出\"这是实打实攒下来的东西\"。计数器同步跳格把数量感钉死。",
    "use": "feed/雷达/收件箱类\"每天有新东西\"的镜头；强调持续积累的资产列表",
    "frames": 88,
    "holdFrame": 87,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Paper Radar"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Of 31 Fetched Today"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "0123456789"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-morph-from-primitive",
    "card": "morph-from-primitive",
    "style": "morph-from-primitive",
    "name": "原型变形",
    "category": "ui-entrance",
    "description": "原型变形——正圆呼吸一拍（anticipation）后 SVG path 插值 24f 长成圆角卡轮廓，内容淡入",
    "intention": "入场库全是\"从外面进来\"——飞入、砸落、翻面，主体都预先存在于画外； 本卡是**就地长出来**：画面中心一个描边正圆先鼓一口气（scale 1→1.12→1），随即轮廓连续变形为圆角矩形卡片，内容再淡入。原型 停留加呼吸这一拍就是预备动作——迪士尼 anticipation 的图形学翻译： 圆先\"吸气\"，观众就知道它要变，变形本身因此不需要任何解释。 仅适用图形/图标/卡轮廓类主体——位图截图不能 morph。",
    "use": "图形/图标/卡轮廓类主体的入场；logo→UI 容器的经典原语",
    "frames": 140,
    "holdFrame": 139,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-neon-frame-forerun",
    "card": "neon-frame-forerun",
    "style": "neon-frame-forerun",
    "name": "霓虹框先行",
    "category": "ui-entrance",
    "description": "强透视直角霓虹框自左缘两头奔画先行成型，页面在框内由暗转亮，同时框内组件/文字从 3D 上空带同形软影错峰贴落、随页面点亮同步完成贴合，背景霓虹管群终段熄灭让位",
    "intention": "先立框后填肉：霓虹线框像跑道灯一样两头奔画圈出位置，宣告 \"这里要出现东西\"；页面在框内由暗转亮的同时，组件从空中带影 贴落——观众看见界面被\"安放\"进框里。三层动作（框奔画/页面点亮/ 组件贴落）必须**同步咬合**：贴落进程与点亮进程同步推进、稍滞后 收尾，框光最终并入面板辉光。背景霓虹管群终段熄灭，把亮度让给 主角完成收束。",
    "use": "暗场品牌片里给 UI 面板做\"登场仪式\"（框先到、内容后落）；功能区首次亮相；霓虹/赛博调性的段落开场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-neon-frame-forerun-orbit",
    "card": "neon-frame-orbit-drop",
    "style": "neon-frame-orbit-drop",
    "name": "霓虹框环绕齐落",
    "category": "ui-entrance",
    "description": "霓虹框先行描框后，镜头绕页面左→右弧线旋转，页面全部组件/文字**同帧**从空中往下贴合（同形软影同步收敛）——整体登场式的框内安放",
    "intention": "neon-frame-forerun 的孪生变体：同样框先行、内容后落，但镜头 不是固定的——从页面左侧视角连续弧线旋转到右侧视角，旋转进行 的同时全部组件从空中贴落。命门是**同时贴合**：所有组件和文字 同帧起落、同帧贴合、软影同步消失——这是\"整体登场\"的语法 （判例：错峰版被裁\"应该是所有组件和文字同时从空中往下贴合\"）。 错峰贴落属于巡礼镜（graze-face-tour/runway），一页一次性亮相 必须齐落，节奏语义不能混用。",
    "use": "单页 UI 的一次性隆重登场（与巡礼/逐区亮相相对）；暗场霓虹调性段落的主视觉揭幕；neon-frame-forerun 的姊妹镜",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-page-waterfall-wall",
    "card": "page-waterfall-wall",
    "style": "page-waterfall-wall",
    "name": "页面瀑布墙",
    "category": "ui-entrance",
    "description": "页面瀑布墙——真实页面截图切成 3–4 列在 3D 后仰墙面上差速反向无限滚动，视差 + 镜头缓推做\"内容多到流不完\"的一览",
    "intention": "流动式一览：让观众在几秒内\"看到很多页面流过\"，读感是体量而非细节。 与 outro-group-photo-launch 分工：那是**聚拢式**一览（元素飞来围住 字标定格合影，语义\"属于同一产品\"），本卡是**流动式**一览（内容持续 流过不定格，语义\"还有很多没给你看完\"）。与 odometer-digit-roll 分工： 那是有终值的机械滚轮（逐位停稳读数字），本卡无终值无限循环。 与 wall-reveal-moves 分工：那是整墙**入场动作**，本卡是墙的**持续状态**， 可用那卡入场后交棒本卡续流。",
    "use": "\"多页面/多功能/多模板\"体量感段落；montage 中段铺陈或 intro 后的产品广度镜头",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-masking-tape-slap",
    "card": "paper-craft-moves",
    "style": "masking-tape-slap",
    "name": "胶带拍贴",
    "category": "ui-entrance",
    "description": "纸艺两式——masking-tape-slap 纸胶带拍定（悬浮微晃被\"啪啪\"按死）与 popup-book-rise 立体书立起（卡片沿底边错峰立墙）",
    "intention": "Wes Anderson 手账美术与立体书纸艺的 UI 翻译。A：卡片轻飘入位后 悬着微晃（未固定的纸），两条撕边半透明胶带\"啪、啪\"先后拍在对角， 第二条拍下**同帧**卡片停晃、投影变薄、整卡下沉——\"按死\"的定妆 一瞬是主角，两声\"啪\"是天然音效点。B：整页平躺如摊开书页（俯视）， 卡片像贴在页上的纸片沿各自底边错峰立起成墙，立到 95° 回弹 90° （纸的韧性），根部投影随立起收窄。",
    "use": "纸墨主视觉片的实体材料语言：单卡定妆入场用 A、整版 dashboard 开场建立用 B；与纸墨+强调色的主视觉（模板片为纸/墨/琥珀）天然同源",
    "frames": 140,
    "holdFrame": 139,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "MASKING TAPE SLAP"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-popup-book-rise",
    "card": "paper-craft-moves",
    "style": "popup-book-rise",
    "name": "立体书升起",
    "category": "ui-entrance",
    "description": "纸艺两式——masking-tape-slap 纸胶带拍定（悬浮微晃被\"啪啪\"按死）与 popup-book-rise 立体书立起（卡片沿底边错峰立墙）",
    "intention": "Wes Anderson 手账美术与立体书纸艺的 UI 翻译。A：卡片轻飘入位后 悬着微晃（未固定的纸），两条撕边半透明胶带\"啪、啪\"先后拍在对角， 第二条拍下**同帧**卡片停晃、投影变薄、整卡下沉——\"按死\"的定妆 一瞬是主角，两声\"啪\"是天然音效点。B：整页平躺如摊开书页（俯视）， 卡片像贴在页上的纸片沿各自底边错峰立起成墙，立到 95° 回弹 90° （纸的韧性），根部投影随立起收窄。",
    "use": "纸墨主视觉片的实体材料语言：单卡定妆入场用 A、整版 dashboard 开场建立用 B；与纸墨+强调色的主视觉（模板片为纸/墨/琥珀）天然同源",
    "frames": 160,
    "holdFrame": 159,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-platform-hinge-rise",
    "card": "platform-hinge-rise",
    "style": "platform-hinge-rise",
    "name": "平台铰接升起",
    "category": "ui-entrance",
    "description": "承托平台先横向建立，两块主体从相邻底部铰点反向翻起并做一次克制阻尼回摆，最后结论台从画外升入，形成“舞台→证据→结论”的三段式揭示",
    "intention": "先让平台成为可信的“承托关系”，再让两个主体从平台后方翻起，观众会自然把它们 理解为同组证据；最后从下方升起的结论台不是第三个平级元素，而是对前两者的归纳。 固定机位和明确的遮挡顺序让这张卡适合解释性 B-roll，也能换成产品卡、人物、建筑或 对比方案。核心不是“东西从下方出现”，而是**两个相邻铰点产生方向相反的展开力**。",
    "use": "两个主体/方案/品牌并列登场；建筑、设备、卡片从基座后升起；需要在一个固定机位里完成“先摆证据再下结论”的解释镜头",
    "frames": 104,
    "holdFrame": 103,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "SUBJECT"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "CONTEXT"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "OUTCOME"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-product-card-progressive-assemble",
    "card": "product-card-progressive-assemble",
    "style": "product-card-progressive-assemble",
    "name": "字段逐个落位",
    "category": "ui-entrance",
    "description": "详情卡像被逐字段抓取般自建——图→标题→breadcrumb pill 依次 pop→原价出现后被划线降级、强调色新价 spring 跳出→正文逐行揭示且高亮块由左向右刷过→色卡点亮，整卡全程极慢 scale 前推",
    "intention": "一张详情卡直接淡入，观众只看到\"有一张卡\"。逐字段落位则把卡变成一份**正在被填写的 表单**：每个字段各自到位，观众的注意力被牵着走一遍卡的信息结构——图在哪、标题在哪、 价格在哪、正文重点在哪。价格划线降级是全片唯一的语义事件（不是\"出现\"而是\"改变\"）， 所以它被安排在中段最显眼的位置。",
    "use": "商品/条目详情页的能力展示；\"结构化抽取\"\"自动填充\"\"数据自己长出来\"类叙事的主镜头",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Placeholder copy for "
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "a key highlight"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": " in the"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "product body. "
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Second highlight"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": " sits here on"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "the third line of neutral sample text."
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Sample Product Title"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "$249"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "$189"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-radial-wave",
    "card": "radial-wave",
    "style": "radial-wave",
    "name": "点阵涟漪",
    "category": "ui-entrance",
    "description": "17×9 圆点阵列按到波源的欧氏距离错峰点亮，每点 scale 过冲到 1.5 再落回常亮，第一道波扫完后第二道亮蓝脉冲从外圈反向收拢回中心",
    "intention": "把\"很多点同时存在\"这件静态事实，改写成\"能量从一个源头扩散到全体\"的动态事实。观众 看到的不是一张点阵图，而是一次通电：中心先亮，亮度像水波推过去，走完之后整张阵列 留在常亮态——为下一拍要放的内容铺好底。第二道反向波是回执，告诉观众这个系统会回应。",
    "use": "产品/品牌开场的\"系统上电\"一拍；也用作数据网格、节点地图、覆盖范围类叙事的建立镜头",
    "frames": 114,
    "holdFrame": 113,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-research-card-stack-scroll",
    "card": "research-card-stack-scroll",
    "style": "research-card-stack-scroll",
    "name": "论文卡叠压",
    "category": "ui-entrance",
    "description": "深色论文卡每 12 帧一张沿右下轴线飞入中心叠压，落位带 1 帧压缩，只有最上一张全清晰渲染标题+作者+摘要，下方卡按堆积深度递增模糊变暗只露标题条，背景横向 grid 同步下移做速度参照",
    "intention": "要说的是\"数量\"，但一次给 13 张卡会读成一堵墙。改成流水线：卡一张一张进，每张都被 读过（最上一张永远是全文渲染的那张），读完就沉进堆里变模糊。观众感受到的是持续不断 的吞吐量，而不是一个静态的堆。背景 grid 同速下移是速度参照——没有它，堆积会读作 \"卡在原地缩小\"。",
    "use": "\"读了大量资料/处理了海量文档\"的量级交代；研究类、检索类、批处理类产品的能力镜头",
    "frames": 144,
    "holdFrame": 143,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-row-embed",
    "card": "row-embed",
    "style": "row-embed",
    "name": "行元素嵌入",
    "category": "ui-entrance",
    "description": "内容行像卡片一样从空中降下、rotateX 收平、嵌入瞬间底边亮一道强调色的缝",
    "intention": "详情页的行不是\"显示出来\"而是\"长进去\"——每一行从空中降下并严丝合缝嵌入页面布局，嵌入瞬间的强调色缝是\"咔哒\"扣上的视觉拟音。",
    "use": "\"结构化数据长进页面\"的详情页/列表镜头；行级内容的批量入场",
    "frames": 68,
    "holdFrame": 67,
    "texts": [],
    "imageKeys": [
      "textures/live/detail-full.png"
    ],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 1,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-runway-ground-skim",
    "card": "runway-ground-skim",
    "style": "runway-ground-skim",
    "name": "跑道掠地贴落",
    "category": "ui-entrance",
    "description": "低角度掠地机位下 UI 卡片群从空中一阵急雨式快速贴落（起点微错、下落大量重叠并行、着地即停零回弹），落齐后整页立起、视角转正收尾",
    "intention": "把界面拍成跑道：低角度透视里 UI 卡片悬空在不同高度，随后按界面 位置顺序（行优先左→右）一阵急雨式贴落——掉落感=干脆利落。 三个命门：**重叠并行**（起点只错 1.5f、下落 9f ⇒ 空中恒有 5–6 张 同时在落，\"几乎一起但有涟漪感\"；串行等待两轮被裁）、**零回弹** （着地即停，弹起被裁）、**快**（下落 9f，15f 版被裁\"快一点\"）。 落齐后页面从躺倒立起（rotateX 66°→0°）、镜头拉远居中，观众从 \"看戏\"回到\"看界面\"。",
    "use": "仪表盘/卡片流界面的登场（内容\"从天而降完成自己\"）；低角度炫技段后的收正；clickup 系悬空贴落语言的\"齐落\"重型版",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Creative Refresh"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "New logo exploration"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "New Bugs Per Week"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Bug tracker Dashboard"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "Tiger Team Roadmap"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "Roadmap Outline"
      },
      {
        "key": "copy6",
        "label": "文字 7",
        "default": "Design System"
      },
      {
        "key": "copy7",
        "label": "文字 8",
        "default": "Design Handbook Inspo"
      },
      {
        "key": "copy8",
        "label": "文字 9",
        "default": "Development Sprint Dashboard"
      },
      {
        "key": "copy9",
        "label": "文字 10",
        "default": "Dev Team Sprints"
      },
      {
        "key": "copy10",
        "label": "文字 11",
        "default": "CSS Bug Tracker"
      },
      {
        "key": "copy11",
        "label": "文字 12",
        "default": "Query Reports"
      },
      {
        "key": "copy12",
        "label": "文字 13",
        "default": "Platform"
      },
      {
        "key": "copy13",
        "label": "文字 14",
        "default": "System Health Monitor"
      },
      {
        "key": "copy14",
        "label": "文字 15",
        "default": "ClickUp"
      },
      {
        "key": "copy15",
        "label": "文字 16",
        "default": "SPACES"
      },
      {
        "key": "copy16",
        "label": "文字 17",
        "default": "Product analytics"
      },
      {
        "key": "copy17",
        "label": "文字 18",
        "default": "ClickUp 3.0"
      },
      {
        "key": "copy18",
        "label": "文字 19",
        "default": "Widget brainstorm"
      },
      {
        "key": "copy19",
        "label": "文字 20",
        "default": "Design system"
      },
      {
        "key": "copy20",
        "label": "文字 21",
        "default": "Design"
      },
      {
        "key": "copy21",
        "label": "文字 22",
        "default": "Home"
      },
      {
        "key": "copy22",
        "label": "文字 23",
        "default": "Search by app, filetype, or keyword"
      },
      {
        "key": "copy23",
        "label": "文字 24",
        "default": "Recent"
      },
      {
        "key": "copy24",
        "label": "文字 25",
        "default": "Favorites"
      },
      {
        "key": "copy25",
        "label": "文字 26",
        "default": "Todo"
      },
      {
        "key": "copy26",
        "label": "文字 27",
        "default": "Comments"
      },
      {
        "key": "copy27",
        "label": "文字 28",
        "default": "Done"
      },
      {
        "key": "copy28",
        "label": "文字 29",
        "default": "Delegated"
      },
      {
        "key": "copy29",
        "label": "文字 30",
        "default": "TODAY"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-skeleton-reveal",
    "card": "skeleton-reveal",
    "style": "skeleton-reveal",
    "name": "骨架显影",
    "category": "ui-entrance",
    "description": "草稿→骨架→内容三级显影——手绘涂鸦占位（煮沸抖动）一拍被灰条骨架窗口替换，骨架列表滚入后镜头推近、灰条逐行显影成头像+逐词文字，末词晚半拍落地",
    "intention": "UI 登场库全是\"整页一次到位\"（飞入/落位/擦出）。本卡把登场拆成 **三级保真度跃迁**：手绘涂鸦（想法）→ 灰条骨架（结构）→ 真实内容 （产品），每次跃迁都是一拍\"变成真的\"的爽点，观众跟着走完\"从草图 到产品\"的叙事弧。骨架→内容的显影借的是加载态语法——用户天天见 skeleton screen，看到灰条就知道\"内容要来了\"，预期免费。与 document-typewriter-reveal 分工：那是**一份文档**被逐块写出来（内容是 主角、要读字）；本卡是**一个界面**逐级变真（结构是主角、字是最后 一级质感）。与 ai-stream-response 分工：那是证据行逐条\"汇入\"（列表 在生长），本卡是已就位的占位\"显影\"（布局早定，保真度在升级）。",
    "use": "产品 UI 的\"从无到有\"登场叙事；开场后第一次亮产品界面的段落",
    "frames": 172,
    "holdFrame": 171,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Ana"
      },
      {
        "key": "copy1",
        "label": "文字 2",
        "default": "Ben"
      },
      {
        "key": "copy2",
        "label": "文字 3",
        "default": "Kai"
      },
      {
        "key": "copy3",
        "label": "文字 4",
        "default": "Mia"
      },
      {
        "key": "copy4",
        "label": "文字 5",
        "default": "9:0"
      },
      {
        "key": "copy5",
        "label": "文字 6",
        "default": "AM"
      }
    ],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-svg-shape-morph",
    "card": "svg-shape-morph",
    "style": "svg-shape-morph",
    "name": "轮廓变形",
    "category": "ui-entrance",
    "description": "一条 140 点闭合轮廓平滑变形为另一条再变回，两形状先在极坐标下重采样到相同点数、逐点半径插值 + inOutCubic，变形中段叠轻微 scale 呼吸、缓慢自转与色相从 185° 漂到 305°",
    "intention": "\"形态会变\"这件事，用两张图交叉淡入是说不清的——观众看到的是两个东西重叠。真正的 morph 要让观众相信这一直是**同一个东西**在改变形状。等点数重采样加逐点插值就是这个 \"同一性\"的技术保证：没有点的生成或消失，只有半径在变。变回原形是为了闭环——观众 看到往返，才知道这是可逆的能力而不是一次性的变身。",
    "use": "抽象概念的\"形态转换/自适应/有机生长\"表达；开场 logo 前的氛围一拍，或章节之间的过渡形",
    "frames": 156,
    "holdFrame": 155,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-value-stagger-gradient",
    "card": "value-stagger-gradient",
    "style": "value-stagger-gradient",
    "name": "数值梯度铺开",
    "category": "ui-entrance",
    "description": "16 根柱入场时 delay 是时间错峰，同时高度/色相/位移/模糊四个属性各自铺成从首到末的数值梯度；第二拍把错峰原点换成中心，脉冲幅度以中心为最大重新铺开",
    "intention": "stagger 通常只被用来错开时间。这张卡要说的是它还能错开**值**——同一个索引既决定 \"什么时候动\"，也决定\"动到多少\"。两拍是一组对照实验：第一拍原点在首位（梯度从左到 右单调铺开），第二拍原点换到中心（梯度以中轴对称铺开）。观众看到的不是两个动画， 而是同一个配方换了一个参数。屏幕上的代码字幕同步换成对应的 stagger 调用，明说这件事。",
    "use": "技法演示与参数化能力的展示镜头；也可直接当数据/频谱/均衡器类界面的入场",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": []
  },
  {
    "id": "shotcraft-bento-light-up",
    "card": "wall-reveal-moves",
    "style": "bento-light-up",
    "name": "逐格点亮",
    "category": "ui-entrance",
    "description": "整墙批量入场三式——bento 逐格点亮、网格波浪翻面、蓝图描线成形，全部原位显形不位移，与 deck-deal-flyin 的飞入位移型互补成品类矩阵",
    "intention": "\"一墙内容怎么出场\"库内此前只有 deck-deal-flyin 一个答案——高能量、位移型、 \"东西涌进来\"。但不是每面墙都该涌：品牌段要庄重、功能墙要轻快、 \"从设计到实物\"要讲工序。这三式共同点是**非位移批量入场**——元素原地显形， 版式从第一帧就成立，观众看的是\"状态变化的波前扫过一面墙\"而不是\"物体飞行\"。 选型先问一句：这面墙该\"涌进来\"还是\"亮起来\"？前者去 deck-deal-flyin，后者进本卡。",
    "use": "功能墙/卡片墙/整页界面的整体亮相；内容已在原位、要\"显形\"而非\"涌入\"的段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [
      {
        "key": "copy0",
        "label": "文字 1",
        "default": "Features"
      }
    ],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-grid-wave-flip",
    "card": "wall-reveal-moves",
    "style": "grid-wave-flip",
    "name": "波浪翻面",
    "category": "ui-entrance",
    "description": "整墙批量入场三式——bento 逐格点亮、网格波浪翻面、蓝图描线成形，全部原位显形不位移，与 deck-deal-flyin 的飞入位移型互补成品类矩阵",
    "intention": "\"一墙内容怎么出场\"库内此前只有 deck-deal-flyin 一个答案——高能量、位移型、 \"东西涌进来\"。但不是每面墙都该涌：品牌段要庄重、功能墙要轻快、 \"从设计到实物\"要讲工序。这三式共同点是**非位移批量入场**——元素原地显形， 版式从第一帧就成立，观众看的是\"状态变化的波前扫过一面墙\"而不是\"物体飞行\"。 选型先问一句：这面墙该\"涌进来\"还是\"亮起来\"？前者去 deck-deal-flyin，后者进本卡。",
    "use": "功能墙/卡片墙/整页界面的整体亮相；内容已在原位、要\"显形\"而非\"涌入\"的段落",
    "frames": 130,
    "holdFrame": 129,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  },
  {
    "id": "shotcraft-wireframe-draw-on",
    "card": "wall-reveal-moves",
    "style": "wireframe-draw-on",
    "name": "蓝图描线成形",
    "category": "ui-entrance",
    "description": "整墙批量入场三式——bento 逐格点亮、网格波浪翻面、蓝图描线成形，全部原位显形不位移，与 deck-deal-flyin 的飞入位移型互补成品类矩阵",
    "intention": "\"一墙内容怎么出场\"库内此前只有 deck-deal-flyin 一个答案——高能量、位移型、 \"东西涌进来\"。但不是每面墙都该涌：品牌段要庄重、功能墙要轻快、 \"从设计到实物\"要讲工序。这三式共同点是**非位移批量入场**——元素原地显形， 版式从第一帧就成立，观众看的是\"状态变化的波前扫过一面墙\"而不是\"物体飞行\"。 选型先问一句：这面墙该\"涌进来\"还是\"亮起来\"？前者去 deck-deal-flyin，后者进本卡。",
    "use": "功能墙/卡片墙/整页界面的整体亮相；内容已在原位、要\"显形\"而非\"涌入\"的段落",
    "frames": 150,
    "holdFrame": 149,
    "texts": [],
    "imageKeys": [],
    "slots": [
      {
        "id": "images",
        "label": "镜头图片（按顺序）",
        "kind": "image",
        "minItems": 0,
        "maxItems": 12
      }
    ]
  }
];
export function libraryShot(id: string) { return SHOTCRAFT_LIBRARY.find((shot) => shot.id === id); }
