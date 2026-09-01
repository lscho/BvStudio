import { EASING_NAMES, eased as evaluateEasing, type EasingName } from "@/domain/easing";

export type EffectCategory = "标题" | "强调" | "卡片" | "标注" | "数据" | "布局" | "场景";
export type EffectLayout = "highlight" | "number" | "panel" | "underline" | "frame";
export type EffectEntrance = "slide-left" | "fade-up" | "pop" | "none";
export type EffectAnimationEasing = EasingName;
export { EASING_NAMES };

/** Declarative data-driven motion graphic; rendered identically in preview and export. */
export interface ChartSpec {
  kind: "counter" | "bar" | "donut" | "line";
  /** Counter only: numeric range rolled through during playback. */
  startValue?: number;
  endValue?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Bar/line/donut payload. */
  categories?: string[];
  series?: number[];
  comparison?: number[];
  /** Upper bound of the value axis; defaults to a rounded max of the series. */
  maxY?: number;
  unit?: string;
  gridLines?: number;
  /** Seconds for the full reveal before easing by overlay speed; default 1.2. */
  durationSeconds?: number;
}

export interface EffectKeyframe {
  offset: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  /** Schema v4: per-segment easing applied on the interval ending at this keyframe. */
  easing?: EffectAnimationEasing;
  /** Schema v4: pseudo-3D tilt in degrees (-80..80); previewed via CSS 3D, exported with foreshortening approximation. */
  rotateX?: number;
  rotateY?: number;
  perspective?: number;
}

export interface EffectAnimation {
  durationSeconds: number;
  easing: EffectAnimationEasing;
  keyframes: EffectKeyframe[];
}

export interface EffectRecipe {
  layout: EffectLayout;
  entrance: EffectEntrance;
  paddingX: number;
  paddingY: number;
  borderWidth: number;
  borderRadius: number;
  backgroundOpacity: number;
  animation?: EffectAnimation;
  /** Schema v4: replaces the plain text layer with a procedural chart when present. */
  chart?: ChartSpec;
  /** Full-canvas background scene rendered below every video and graphic layer. */
  sceneBackground?: SceneBackgroundSpec;
}

export interface EffectSoundCue {
  soundId: string;
  offsetUs: number;
  volume: number;
  durationUs: number;
  sourcePath?: string;
}

export interface SceneBackgroundSpec {
  preset: "black-stripes" | "white-frame" | "dark-grid" | "clean-white" | "spotlight" | "blueprint" | "paper-lines" | "contrast-side";
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  intensity: number;
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  tags: string[];
  defaultDurationUs: number;
  defaultText: string;
  defaultColor: string;
  defaultAccentColor: string;
  recipe: EffectRecipe;
  soundCues?: EffectSoundCue[];
  kind?: "effect" | "scene";
  sceneLayers?: SceneEffectTemplateLayer[];
}

export interface SceneEffectTemplateLayer {
  effectId: string;
  text?: string;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  fontSize?: number;
  zIndex: number;
  startRatio?: number;
  durationRatio?: number;
}

const CORE_EFFECTS: readonly EffectDefinition[] = [
  {
    id: "title-highlight",
    name: "标题强调",
    category: "标题",
    description: "标题滑入并带高亮底色",
    tags: ["标题", "开场", "观点"],
    defaultDurationUs: 2_500_000,
    defaultText: "核心观点",
    defaultColor: "#f7f8fa",
    defaultAccentColor: "#ffb84d",
    recipe: { layout: "highlight", entrance: "slide-left", paddingX: 18, paddingY: 10, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0 }
  },
  {
    id: "number-pop",
    name: "数字弹出",
    category: "强调",
    description: "适合数据、金额和比例",
    tags: ["数字", "数据", "重点"],
    defaultDurationUs: 1_800_000,
    defaultText: "85%",
    defaultColor: "#ffffff",
    defaultAccentColor: "#47d7ac",
    recipe: { layout: "number", entrance: "pop", paddingX: 18, paddingY: 8, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0 }
  },
  {
    id: "bullet-reveal",
    name: "要点逐条",
    category: "卡片",
    description: "分步骤呈现列表内容",
    tags: ["步骤", "教程", "列表"],
    defaultDurationUs: 4_000_000,
    defaultText: "第一步  明确目标",
    defaultColor: "#f4f6f8",
    defaultAccentColor: "#5fa8ff",
    recipe: { layout: "panel", entrance: "slide-left", paddingX: 22, paddingY: 16, borderWidth: 4, borderRadius: 3, backgroundOpacity: 0.82 }
  },
  {
    id: "quote-card",
    name: "引用卡片",
    category: "卡片",
    description: "用于金句与总结",
    tags: ["金句", "引用", "总结"],
    defaultDurationUs: 3_200_000,
    defaultText: "让重要内容被看见",
    defaultColor: "#ffffff",
    defaultAccentColor: "#ff7b72",
    recipe: { layout: "frame", entrance: "fade-up", paddingX: 28, paddingY: 20, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.88 }
  },
  {
    id: "underline-sweep",
    name: "手绘下划线",
    category: "标注",
    description: "从左向右强调关键词",
    tags: ["关键词", "强调", "标注"],
    defaultDurationUs: 2_200_000,
    defaultText: "关键结论",
    defaultColor: "#ffffff",
    defaultAccentColor: "#ffd166",
    recipe: { layout: "underline", entrance: "fade-up", paddingX: 14, paddingY: 10, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  },
  {
    id: "picture-stack",
    name: "多画面拼贴",
    category: "布局",
    description: "组合多个片段或图片",
    tags: ["案例", "对比", "回顾"],
    defaultDurationUs: 4_500_000,
    defaultText: "案例回顾",
    defaultColor: "#ffffff",
    defaultAccentColor: "#9b8cff",
    recipe: {
      layout: "frame", entrance: "none", paddingX: 30, paddingY: 22, borderWidth: 1, borderRadius: 2, backgroundOpacity: 0.86,
      animation: {
        durationSeconds: 0.6,
        easing: "ease-out",
        keyframes: [
          { offset: 0, translateX: 18, translateY: 24, scale: 0.72, rotation: 8 },
          { offset: 0.72, translateX: -2, translateY: -3, scale: 1.04, rotation: -1 },
          { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0 }
        ]
      }
    }
  }
] as const;

/** Procedural data-driven effects; pixels are generated per frame from the chart spec. */
const CHART_EFFECTS: readonly EffectDefinition[] = [
  {
    id: "data-counter",
    name: "数字结论",
    category: "数据",
    description: "大号核心数字与进度强调线",
    tags: ["数字", "数据", "增长", "统计", "金额", "比例", "counter"],
    defaultDurationUs: 2_400_000,
    defaultText: "核心数据",
    defaultColor: "#ffffff",
    defaultAccentColor: "#47d7ac",
    recipe: {
      layout: "frame", entrance: "none", paddingX: 22, paddingY: 18, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74,
      chart: { kind: "counter", startValue: 0, endValue: 85, suffix: "%", decimals: 0, durationSeconds: 1.1 }
    }
  },
  {
    id: "data-bar-chart",
    name: "横向数据对比",
    category: "数据",
    description: "横向条形错峰展开，突出核心差异",
    tags: ["图表", "数据", "对比", "增长", "统计", "bar"],
    defaultDurationUs: 3_600_000,
    defaultText: "近四个月增长",
    defaultColor: "#ffffff",
    defaultAccentColor: "#47d7ac",
    recipe: {
      layout: "frame", entrance: "none", paddingX: 26, paddingY: 20, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74,
      chart: { kind: "bar", series: [32, 48, 41, 76], comparison: [24, 39, 44, 52], categories: ["一月", "二月", "三月", "四月"], unit: "", gridLines: 3, durationSeconds: 1.4 }
    }
  },
  {
    id: "data-donut-chart",
    name: "重点占比",
    category: "数据",
    description: "主占比居中，构成信息在侧边清晰展开",
    tags: ["图表", "占比", "数据", "百分比", "构成", "donut"],
    defaultDurationUs: 3_200_000,
    defaultText: "渠道构成",
    defaultColor: "#ffffff",
    defaultAccentColor: "#5fa8ff",
    recipe: {
      layout: "frame", entrance: "none", paddingX: 26, paddingY: 22, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74,
      chart: { kind: "donut", series: [45, 30, 25], categories: ["搜索", "推荐", "直达"], suffix: "%", durationSeconds: 1.3 }
    }
  },
  {
    id: "data-line-chart",
    name: "趋势变化",
    category: "数据",
    description: "平滑趋势线逐段绘制并强调最终结论",
    tags: ["图表", "趋势", "数据", "走势", "line"],
    defaultDurationUs: 3_600_000,
    defaultText: "全年走势",
    defaultColor: "#ffffff",
    defaultAccentColor: "#b59cff",
    recipe: {
      layout: "frame", entrance: "none", paddingX: 26, paddingY: 20, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74,
      chart: { kind: "line", series: [18, 34, 29, 46, 61, 55, 72], categories: ["一月", "二月", "三月", "四月", "五月", "六月", "七月"], gridLines: 3, durationSeconds: 1.5 }
    }
  }
];

interface EffectFamily {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  tags: string[];
  text: string;
  accent: string;
}

const EFFECT_FAMILIES: readonly EffectFamily[] = [
  { id: "intro", name: "开场", category: "标题", description: "建立主题与第一印象", tags: ["开场", "片头", "标题", "介绍"], text: "今天聊一个重要话题", accent: "#5fa8ff" },
  { id: "data", name: "数据", category: "强调", description: "突出数字、比例和增长", tags: ["数据", "数字", "增长", "比例", "金额"], text: "增长 42%", accent: "#47d7ac" },
  { id: "steps", name: "步骤", category: "卡片", description: "展示方法、流程和清单", tags: ["步骤", "流程", "教程", "方法", "清单"], text: "第一步：明确目标", accent: "#6ea8fe" },
  { id: "quote", name: "金句", category: "卡片", description: "呈现观点、引用和总结", tags: ["金句", "引用", "观点", "总结", "结论"], text: "重要的不是更多，而是更清楚", accent: "#ff7b72" },
  { id: "keyword", name: "关键词", category: "标注", description: "标记重点概念与术语", tags: ["关键词", "重点", "强调", "概念", "术语"], text: "核心能力", accent: "#ffd166" },
  { id: "compare", name: "对比", category: "布局", description: "表达前后、优劣与差异", tags: ["对比", "区别", "前后", "优劣", "变化"], text: "之前 vs 现在", accent: "#b59cff" },
  { id: "question", name: "提问", category: "标题", description: "用问题制造悬念和转折", tags: ["问题", "提问", "为什么", "如何", "悬念"], text: "为什么会这样？", accent: "#45c4b0" },
  { id: "warning", name: "警示", category: "强调", description: "提示风险、误区和注意事项", tags: ["警告", "风险", "误区", "注意", "避免"], text: "注意这个常见误区", accent: "#ff6b6b" },
  { id: "product", name: "产品", category: "布局", description: "介绍功能、案例和卖点", tags: ["产品", "功能", "卖点", "案例", "展示"], text: "一个更高效的方案", accent: "#7dd3a7" },
  { id: "ending", name: "结尾", category: "标题", description: "完成总结、行动号召和收束", tags: ["结尾", "收尾", "总结", "行动", "关注"], text: "把想法变成行动", accent: "#f0a55b" }
] as const;

const EFFECT_PRESENTATIONS = [
  { id: "highlight", name: "高亮条", layout: "highlight" as const, entrance: "slide-left" as const },
  { id: "impact", name: "冲击字", layout: "number" as const, entrance: "pop" as const },
  { id: "panel", name: "侧栏卡", layout: "panel" as const, entrance: "slide-left" as const },
  { id: "underline", name: "手绘线", layout: "underline" as const, entrance: "fade-up" as const },
  { id: "frame", name: "描边框", layout: "frame" as const, entrance: "none" as const }
] as const;

function familyEffect(family: EffectFamily, presentation: typeof EFFECT_PRESENTATIONS[number], familyIndex: number): EffectDefinition {
  const framed = presentation.layout === "frame";
  return {
    id: `${family.id}-${presentation.id}`,
    name: `${family.name} · ${presentation.name}`,
    category: family.category,
    description: `${family.description}，使用${presentation.name}呈现`,
    tags: [...family.tags, presentation.name, presentation.id],
    defaultDurationUs: 2_200_000 + familyIndex % 4 * 400_000,
    defaultText: family.text,
    defaultColor: "#ffffff",
    defaultAccentColor: family.accent,
    recipe: {
      layout: presentation.layout,
      entrance: presentation.entrance,
      paddingX: framed ? 26 : presentation.layout === "panel" ? 22 : 16,
      paddingY: framed ? 18 : presentation.layout === "panel" ? 14 : 10,
      borderWidth: presentation.layout === "panel" ? 4 : framed ? 2 : 0,
      borderRadius: framed || presentation.layout === "panel" ? 3 : 1,
      backgroundOpacity: framed ? 0.82 : presentation.layout === "panel" ? 0.78 : 0,
      ...(framed ? {
        animation: {
          durationSeconds: 0.55 + familyIndex % 3 * 0.1,
          easing: "ease-out" as const,
          keyframes: [
            { offset: 0, translateX: familyIndex % 2 ? 14 : -14, translateY: 14, scale: 0.78, rotation: familyIndex % 2 ? 3 : -3 },
            { offset: 0.72, translateX: 0, translateY: -2, scale: 1.04, rotation: 0 },
            { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0 }
          ]
        }
      } : {})
    }
  };
}

const FAMILY_EFFECTS = EFFECT_FAMILIES.flatMap((family, familyIndex) => EFFECT_PRESENTATIONS.map((presentation) => familyEffect(family, presentation, familyIndex)));

const SCENE_EFFECTS: readonly EffectDefinition[] = [
  {
    id: "scene-focus-stack", name: "重点信息组合", category: "场景", kind: "scene", description: "主标题、数字与结论标注组合", tags: ["场景", "组合", "重点", "数据", "字幕", "观点"],
    defaultDurationUs: 4_000_000, defaultText: "核心观点", defaultColor: "#ffffff", defaultAccentColor: "#ffb84d",
    recipe: { layout: "frame", entrance: "fade-up", paddingX: 24, paddingY: 18, borderWidth: 1, borderRadius: 3, backgroundOpacity: 0.72 },
    sceneLayers: [
      { effectId: "title-highlight", x: 50, y: 27, fontSize: 62, zIndex: 30 },
      { effectId: "number-pop", text: "42%", x: 50, y: 52, scale: 0.9, fontSize: 76, zIndex: 20, startRatio: 0.12 },
      { effectId: "underline-sweep", text: "关键结论", x: 50, y: 73, scale: 0.8, fontSize: 38, zIndex: 10, startRatio: 0.28 }
    ]
  },
  {
    id: "scene-quote-summary", name: "金句总结组合", category: "场景", kind: "scene", description: "引用卡、关键词和收束标题叠加", tags: ["场景", "金句", "总结", "引用", "字幕", "结论"],
    defaultDurationUs: 4_500_000, defaultText: "让重要内容被看见", defaultColor: "#ffffff", defaultAccentColor: "#ff7b72",
    recipe: { layout: "frame", entrance: "fade-up", paddingX: 28, paddingY: 20, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.86 },
    sceneLayers: [
      { effectId: "quote-card", x: 50, y: 46, fontSize: 48, zIndex: 20 },
      { effectId: "keyword-underline", text: "核心结论", x: 50, y: 72, scale: 0.75, fontSize: 34, zIndex: 30, startRatio: 0.22 }
    ]
  },
  {
    id: "scene-step-guide", name: "步骤讲解组合", category: "场景", kind: "scene", description: "步骤卡与强调标题组合", tags: ["场景", "步骤", "教程", "流程", "方法", "字幕"],
    defaultDurationUs: 5_000_000, defaultText: "第一步：明确目标", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    recipe: { layout: "panel", entrance: "slide-left", paddingX: 22, paddingY: 16, borderWidth: 4, borderRadius: 3, backgroundOpacity: 0.82 },
    sceneLayers: [
      { effectId: "steps-highlight", text: "方法拆解", x: 50, y: 25, fontSize: 50, zIndex: 30 },
      { effectId: "bullet-reveal", x: 38, y: 54, scale: 0.85, fontSize: 40, zIndex: 20, startRatio: 0.14 },
      { effectId: "steps-underline", text: "照着做即可", x: 63, y: 76, scale: 0.72, fontSize: 32, zIndex: 10, startRatio: 0.32 }
    ]
  },
  {
    id: "scene-warning-callout", name: "风险提示组合", category: "场景", kind: "scene", description: "警示标题、侧栏提示和关键词叠加", tags: ["场景", "警示", "风险", "误区", "注意", "字幕"],
    defaultDurationUs: 4_000_000, defaultText: "注意这个常见误区", defaultColor: "#ffffff", defaultAccentColor: "#ff6b6b",
    recipe: { layout: "panel", entrance: "slide-left", paddingX: 22, paddingY: 14, borderWidth: 4, borderRadius: 3, backgroundOpacity: 0.8 },
    sceneLayers: [
      { effectId: "warning-impact", text: "注意", x: 22, y: 28, fontSize: 68, zIndex: 30 },
      { effectId: "warning-panel", x: 50, y: 53, fontSize: 42, zIndex: 20, startRatio: 0.12 },
      { effectId: "warning-underline", text: "避免踩坑", x: 62, y: 75, scale: 0.72, fontSize: 32, zIndex: 10, startRatio: 0.3 }
    ]
  },
  {
    id: "scene-intro-title", name: "开场标题组合", category: "场景", kind: "scene", description: "开场主标题、副标题与描边框组合", tags: ["场景", "开场", "片头", "标题", "介绍", "字幕"],
    defaultDurationUs: 4_000_000, defaultText: "今天聊一个重要话题", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    recipe: { layout: "frame", entrance: "none", paddingX: 28, paddingY: 20, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.3 },
    sceneLayers: [
      { effectId: "intro-frame", x: 50, y: 48, scale: 1.15, fontSize: 58, zIndex: 10 },
      { effectId: "intro-highlight", x: 50, y: 42, fontSize: 60, zIndex: 30, startRatio: 0.08 },
      { effectId: "intro-underline", text: "从这里开始", x: 50, y: 66, scale: 0.7, fontSize: 30, zIndex: 20, startRatio: 0.24 }
    ]
  },
  {
    id: "scene-comparison", name: "对比结论组合", category: "场景", kind: "scene", description: "对比标题、数据冲击字和结论卡组合", tags: ["场景", "对比", "前后", "变化", "数据", "字幕"],
    defaultDurationUs: 4_500_000, defaultText: "之前 vs 现在", defaultColor: "#ffffff", defaultAccentColor: "#b59cff",
    recipe: { layout: "frame", entrance: "fade-up", paddingX: 26, paddingY: 18, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.76 },
    sceneLayers: [
      { effectId: "compare-highlight", x: 50, y: 25, fontSize: 50, zIndex: 30 },
      { effectId: "compare-impact", text: "VS", x: 50, y: 50, scale: 0.8, fontSize: 76, zIndex: 20, startRatio: 0.12 },
      { effectId: "compare-frame", text: "差异一目了然", x: 50, y: 75, scale: 0.78, fontSize: 34, zIndex: 10, startRatio: 0.28 }
    ]
  }
] as const;

const LEGACY_EFFECTS: readonly EffectDefinition[] = [...CORE_EFFECTS, ...CHART_EFFECTS, ...FAMILY_EFFECTS, ...SCENE_EFFECTS];

const TEST_EFFECTS: readonly EffectDefinition[] = [
  {
    id: "test-title-slide", name: "标题滑入", category: "标题", description: "简洁标题从左侧进入", tags: ["标题", "开场", "主题"],
    defaultDurationUs: 2_500_000, defaultText: "输入标题", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    recipe: { layout: "highlight", entrance: "slide-left", paddingX: 18, paddingY: 10, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0 }
  },
  {
    id: "test-keyword-underline", name: "关键词下划线", category: "标注", description: "为字幕中的关键词增加扫线强调", tags: ["关键词", "强调", "标注"],
    defaultDurationUs: 2_200_000, defaultText: "输入关键词", defaultColor: "#ffffff", defaultAccentColor: "#ffd166",
    recipe: { layout: "underline", entrance: "fade-up", paddingX: 14, paddingY: 9, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  },
  {
    id: "test-quote-card", name: "引用卡片", category: "卡片", description: "用于金句、观点和结论", tags: ["引用", "金句", "观点", "总结"],
    defaultDurationUs: 3_200_000, defaultText: "输入引用内容", defaultColor: "#ffffff", defaultAccentColor: "#ff7b72",
    recipe: { layout: "frame", entrance: "fade-up", paddingX: 28, paddingY: 20, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.86 }
  },
  {
    id: "test-number-counter", name: "数字结论", category: "数据", description: "大号核心数字与进度强调线", tags: ["数字", "数据", "比例", "金额"],
    defaultDurationUs: 2_400_000, defaultText: "核心数据", defaultColor: "#ffffff", defaultAccentColor: "#47d7ac",
    recipe: { layout: "frame", entrance: "none", paddingX: 22, paddingY: 18, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74, chart: { kind: "counter", startValue: 0, endValue: 100, durationSeconds: 1.1 } }
  },
  {
    id: "test-bar-chart", name: "横向数据对比", category: "数据", description: "横向条形错峰展开，突出核心差异", tags: ["图表", "柱状图", "数据", "对比"],
    defaultDurationUs: 3_600_000, defaultText: "关键指标对比", defaultColor: "#ffffff", defaultAccentColor: "#47d7ac",
    recipe: { layout: "frame", entrance: "none", paddingX: 26, paddingY: 20, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74, chart: { kind: "bar", series: [38, 72, 56], categories: ["效率", "质量", "成本"], gridLines: 0, durationSeconds: 1.4 } }
  },
  {
    id: "test-donut-chart", name: "重点占比", category: "数据", description: "主占比居中，构成信息在侧边清晰展开", tags: ["图表", "环形图", "占比", "数据"],
    defaultDurationUs: 3_200_000, defaultText: "渠道构成", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    recipe: { layout: "frame", entrance: "none", paddingX: 24, paddingY: 20, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74, chart: { kind: "donut", series: [54, 28, 18], categories: ["推荐", "搜索", "直达"], durationSeconds: 1.3 } }
  },
  {
    id: "test-line-chart", name: "趋势变化", category: "数据", description: "平滑趋势线逐段绘制并强调最终结论", tags: ["图表", "折线图", "趋势", "数据"],
    defaultDurationUs: 3_600_000, defaultText: "近半年趋势", defaultColor: "#ffffff", defaultAccentColor: "#b59cff",
    recipe: { layout: "frame", entrance: "none", paddingX: 26, paddingY: 20, borderWidth: 1, borderRadius: 4, backgroundOpacity: 0.74, chart: { kind: "line", series: [18, 28, 24, 46, 58, 72], categories: ["一月", "二月", "三月", "四月", "五月", "六月"], gridLines: 0, durationSeconds: 1.5 } }
  },
  {
    id: "test-3d-card-flip", name: "3D 卡片翻转", category: "卡片", description: "卡片沿 Y 轴翻转进入", tags: ["3D", "翻转", "卡片", "转场"],
    defaultDurationUs: 2_800_000, defaultText: "输入卡片内容", defaultColor: "#ffffff", defaultAccentColor: "#47d7ac",
    recipe: { layout: "frame", entrance: "none", paddingX: 28, paddingY: 20, borderWidth: 2, borderRadius: 3, backgroundOpacity: 0.88, animation: { durationSeconds: 0.9, easing: "ease-out", keyframes: [{ offset: 0, translateX: 0, translateY: 8, scale: 0.82, rotation: 0, rotateY: -76, perspective: 1000 }, { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateY: 0, perspective: 1000 }] } }
  },
  {
    id: "test-3d-title-tilt", name: "3D 标题倾斜", category: "标题", description: "标题带空间倾斜与回正", tags: ["3D", "标题", "倾斜", "强调"],
    defaultDurationUs: 2_500_000, defaultText: "输入标题", defaultColor: "#ffffff", defaultAccentColor: "#ffb84d",
    recipe: { layout: "highlight", entrance: "none", paddingX: 20, paddingY: 11, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0, animation: { durationSeconds: 0.8, easing: "ease-out", keyframes: [{ offset: 0, translateX: -18, translateY: 12, scale: 0.78, rotation: -4, rotateX: 34, rotateY: -28, perspective: 1100 }, { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateX: 0, rotateY: 0, perspective: 1100 }] } }
  },
  {
    id: "test-3d-depth-push", name: "3D 景深推进", category: "强调", description: "内容从远处推进到画面", tags: ["3D", "景深", "推进", "冲击"],
    defaultDurationUs: 2_400_000, defaultText: "输入重点内容", defaultColor: "#ffffff", defaultAccentColor: "#6ea8fe",
    recipe: { layout: "number", entrance: "none", paddingX: 18, paddingY: 10, borderWidth: 0, borderRadius: 2, backgroundOpacity: 0, animation: { durationSeconds: 0.75, easing: "ease-out", keyframes: [{ offset: 0, translateX: 0, translateY: 0, scale: 0.25, rotation: 0, rotateX: 18, perspective: 1400 }, { offset: 0.78, translateX: 0, translateY: 0, scale: 1.08, rotation: 0, rotateX: -3, perspective: 1400 }, { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateX: 0, perspective: 1400 }] } }
  },
  {
    id: "test-lower-third", name: "底部信息条", category: "标注", description: "适合人物、地点和补充信息", tags: ["人名", "地点", "说明", "底栏"],
    defaultDurationUs: 3_500_000, defaultText: "输入补充信息", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    recipe: { layout: "panel", entrance: "slide-left", paddingX: 20, paddingY: 12, borderWidth: 4, borderRadius: 2, backgroundOpacity: 0.8 }
  },
  {
    id: "test-callout-panel", name: "侧边提示卡", category: "卡片", description: "在画面侧边承载步骤、解释或提醒", tags: ["步骤", "流程", "方法", "提示", "解释", "注意", "补充", "风险", "误区"],
    defaultDurationUs: 3_200_000, defaultText: "输入提示内容", defaultColor: "#ffffff", defaultAccentColor: "#ff6b6b",
    recipe: { layout: "panel", entrance: "fade-up", paddingX: 22, paddingY: 16, borderWidth: 4, borderRadius: 3, backgroundOpacity: 0.84 }
  },
  ...([
    ["scene-black-stripes", "黑色条纹", "black-stripes", "#111317", "#252a31", "#5fa8ff", "深色斜纹知识讲解背景"],
    ["scene-white-frame", "白色边框", "white-frame", "#f5f6f7", "#ffffff", "#1b1d21", "白底与细边框演示场景"],
    ["scene-dark-grid", "深色网格", "dark-grid", "#15191f", "#29313b", "#47d7ac", "适合数据与技术内容的网格背景"],
    ["scene-clean-white", "清爽白底", "clean-white", "#f7f8fa", "#e9edf2", "#5fa8ff", "轻量知识卡片与产品介绍背景"],
    ["scene-spotlight", "中央聚光", "spotlight", "#0d0f12", "#343b46", "#ffb84d", "中央提亮、四周收暗的舞台场景"],
    ["scene-blueprint", "蓝图网格", "blueprint", "#0f2740", "#25547a", "#7dc4ff", "适合结构、架构和原理讲解"],
    ["scene-paper-lines", "纸张横线", "paper-lines", "#f4f1e9", "#d8d3c8", "#d65a4a", "适合清单、步骤和读书笔记"],
    ["scene-contrast-side", "对比侧栏", "contrast-side", "#f5f6f8", "#1b1f25", "#ffb84d", "带深色侧栏的观点与章节背景"]
  ] as const).map(([id, name, preset, primaryColor, secondaryColor, borderColor, description]) => ({
    id, name, category: "场景" as const, description, tags: ["场景", "背景", name, preset],
    defaultDurationUs: 8_000_000, defaultText: "", defaultColor: primaryColor, defaultAccentColor: borderColor,
    recipe: { layout: "frame" as const, entrance: "none" as const, paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset, primaryColor, secondaryColor, borderColor, intensity: 0.72 } }
  }))
] as const;

export const BUILTIN_EFFECTS: readonly EffectDefinition[] = TEST_EFFECTS;

let installedEffects: EffectDefinition[] = [];

export function setInstalledEffects(effects: EffectDefinition[]) {
  installedEffects = effects;
}

export function allEffects(): EffectDefinition[] {
  return [...BUILTIN_EFFECTS, ...installedEffects];
}

export function effectById(id: string): EffectDefinition {
  return allEffects().find((effect) => effect.id === id)
    ?? LEGACY_EFFECTS.find((effect) => effect.id === id)
    ?? BUILTIN_EFFECTS[0];
}

export function effectSelectionsForText(text: string, limit = 3): EffectDefinition[] {
  const ranked = retrieveEffects(text, Math.max(limit * 3, 6));
  const selected: EffectDefinition[] = [];
  for (const effect of ranked) {
    if (selected.some((item) => item.id === effect.id || (item.kind === "scene" && effect.kind === "scene"))) continue;
    selected.push(effect);
    if (selected.length >= limit) break;
  }
  return selected;
}

function eased(progress: number, easing: EffectAnimationEasing) {
  return evaluateEasing(progress, easing);
}

export interface EffectAnimationState {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
  rotateX: number;
  rotateY: number;
  perspective: number;
}

export function effectAnimationState(recipe: EffectRecipe, elapsedUs: number, speed: number): EffectAnimationState {
  const animation = recipe.animation;
  const rest: EffectAnimationState = { translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateX: 0, rotateY: 0, perspective: 0 };
  if (!animation?.keyframes.length) return rest;
  const durationUs = Math.max(1, animation.durationSeconds * 1_000_000 / Math.max(0.1, speed));
  const progress = Math.max(0, Math.min(1, elapsedUs / durationUs));
  const keyframes = animation.keyframes;
  const first = keyframes[0];
  if (progress <= first.offset) return keyframeState(first);
  for (let index = 1; index < keyframes.length; index += 1) {
    const right = keyframes[index];
    if (progress > right.offset) continue;
    const left = keyframes[index - 1];
    const local = eased((progress - left.offset) / Math.max(0.000_001, right.offset - left.offset), right.easing ?? animation.easing);
    const interpolate = (from?: number, to?: number) => (from ?? 0) + ((to ?? 0) - (from ?? 0)) * local;
    return {
      translateX: interpolate(left.translateX, right.translateX),
      translateY: interpolate(left.translateY, right.translateY),
      scale: (left.scale ?? 1) + ((right.scale ?? 1) - (left.scale ?? 1)) * local,
      rotation: interpolate(left.rotation, right.rotation),
      rotateX: interpolate(left.rotateX, right.rotateX),
      rotateY: interpolate(left.rotateY, right.rotateY),
      perspective: interpolate(left.perspective, right.perspective)
    };
  }
  return keyframeState(keyframes.at(-1)!);
}

function keyframeState(keyframe: Readonly<EffectKeyframe>): EffectAnimationState {
  return {
    translateX: keyframe.translateX,
    translateY: keyframe.translateY,
    scale: keyframe.scale,
    rotation: keyframe.rotation,
    rotateX: keyframe.rotateX ?? 0,
    rotateY: keyframe.rotateY ?? 0,
    perspective: keyframe.perspective ?? 0
  };
}

const INTENT_GROUPS = [
  ["开场", "开篇", "片头", "标题", "主题", "介绍", "引入", "headline", "intro"],
  ["数字", "数据", "金额", "销售额", "比例", "占比", "百分比", "增长", "上涨", "下降", "统计", "指标", "number", "metric"],
  ["步骤", "流程", "方法", "教程", "操作", "清单", "列表", "要点", "攻略", "step", "howto"],
  ["引用", "金句", "总结", "结论", "观点", "名言", "摘录", "quote", "summary"],
  ["强调", "突出", "关键", "关键词", "重点", "注意", "标记", "标注", "highlight", "focus"],
  ["案例", "对比", "回顾", "拼贴", "图片", "画面", "素材", "作品", "展示", "gallery", "comparison"]
] as const;

function normalized(value: string) {
  return value.toLowerCase().normalize("NFKC");
}

function semanticTerms(value: string): string[] {
  const text = normalized(value);
  const compact = text.replace(/[\s，。！？、；：,.!?;:()（）【】\[\]"'“”‘’/_-]+/gu, "");
  const characters = Array.from(compact);
  const tokens = [
    ...characters.map((character) => `c:${character}`),
    ...characters.slice(0, -1).map((character, index) => `b:${character}${characters[index + 1]}`),
    ...(text.match(/[a-z0-9]+/gu) ?? []).map((word) => `w:${word}`)
  ];
  INTENT_GROUPS.forEach((group, index) => {
    for (const term of group) if (text.includes(term)) tokens.push(`intent:${index}`);
  });
  return tokens;
}

function termFrequency(value: string) {
  const counts = new Map<string, number>();
  for (const token of semanticTerms(value)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function cosineScore(query: Map<string, number>, document: Map<string, number>, documentFrequency: Map<string, number>, documentCount: number) {
  let dot = 0;
  let queryNorm = 0;
  let documentNorm = 0;
  const tokens = new Set([...query.keys(), ...document.keys()]);
  for (const token of tokens) {
    const idf = Math.log((documentCount + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
    const queryWeight = (query.get(token) ?? 0) * idf;
    const documentWeight = (document.get(token) ?? 0) * idf;
    dot += queryWeight * documentWeight;
    queryNorm += queryWeight * queryWeight;
    documentNorm += documentWeight * documentWeight;
  }
  return queryNorm && documentNorm ? dot / Math.sqrt(queryNorm * documentNorm) : 0;
}

/** Fully local hybrid semantic retrieval; only the selected definitions are sent to the cloud model. */
export function retrieveEffects(query: string, limit = 4): EffectDefinition[] {
  const effects = allEffects();
  const documents = effects.map((effect) => termFrequency([effect.name, effect.category, effect.description, ...effect.tags].join(" ")));
  const documentFrequency = new Map<string, number>();
  for (const document of documents) for (const token of document.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  const queryVector = termFrequency(query);
  const queryText = normalized(query);
  return effects.map((effect, order) => {
    const semantic = cosineScore(queryVector, documents[order], documentFrequency, effects.length);
    const tagBoost = effect.tags.reduce((sum, tag) => sum + (queryText.includes(normalized(tag)) ? 0.35 : 0), 0);
    const intentBoost = [...queryVector.entries()].reduce((sum, [token, frequency]) => {
      if (!token.startsWith("intent:")) return sum;
      return sum + Math.min(frequency, documents[order].get(token) ?? 0) * 0.25;
    }, 0);
    return { effect, score: semantic + tagBoost + intentBoost, order };
  }).sort((left, right) => right.score - left.score || left.order - right.order).slice(0, Math.max(1, limit)).map(({ effect }) => effect);
}
