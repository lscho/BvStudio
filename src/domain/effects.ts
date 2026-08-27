export type EffectCategory = "标题" | "强调" | "卡片" | "标注" | "布局";
export type EffectLayout = "highlight" | "number" | "panel" | "underline" | "frame";
export type EffectEntrance = "slide-left" | "fade-up" | "pop" | "none";
export type EffectAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface EffectKeyframe {
  offset: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
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

export const BUILTIN_EFFECTS: readonly EffectDefinition[] = [...CORE_EFFECTS, ...FAMILY_EFFECTS];

let installedEffects: EffectDefinition[] = [];

export function setInstalledEffects(effects: EffectDefinition[]) {
  installedEffects = effects;
}

export function allEffects(): EffectDefinition[] {
  return [...BUILTIN_EFFECTS, ...installedEffects];
}

export function effectById(id: string): EffectDefinition {
  return allEffects().find((effect) => effect.id === id) ?? BUILTIN_EFFECTS[0];
}

function eased(progress: number, easing: EffectAnimationEasing) {
  if (easing === "ease-in") return progress * progress;
  if (easing === "ease-out") return 1 - (1 - progress) ** 2;
  if (easing === "ease-in-out") return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
  return progress;
}

export function effectAnimationState(recipe: EffectRecipe, elapsedUs: number, speed: number) {
  const animation = recipe.animation;
  if (!animation?.keyframes.length) return { translateX: 0, translateY: 0, scale: 1, rotation: 0 };
  const durationUs = Math.max(1, animation.durationSeconds * 1_000_000 / Math.max(0.1, speed));
  const progress = Math.max(0, Math.min(1, elapsedUs / durationUs));
  const keyframes = animation.keyframes;
  const first = keyframes[0];
  if (progress <= first.offset) return { translateX: first.translateX, translateY: first.translateY, scale: first.scale, rotation: first.rotation };
  for (let index = 1; index < keyframes.length; index += 1) {
    const right = keyframes[index];
    if (progress > right.offset) continue;
    const left = keyframes[index - 1];
    const local = eased((progress - left.offset) / Math.max(0.000_001, right.offset - left.offset), animation.easing);
    const interpolate = (from: number, to: number) => from + (to - from) * local;
    return {
      translateX: interpolate(left.translateX, right.translateX),
      translateY: interpolate(left.translateY, right.translateY),
      scale: interpolate(left.scale, right.scale),
      rotation: interpolate(left.rotation, right.rotation)
    };
  }
  const last = keyframes.at(-1)!;
  return { translateX: last.translateX, translateY: last.translateY, scale: last.scale, rotation: last.rotation };
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
