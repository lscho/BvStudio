import type { CompositionDefinition, CompositionParams } from "@/domain/effects";
import { referenceMotionMatchingCards, referenceMotionMatchingPolicy } from "@/domain/motionMatchingCatalog.generated";
import { isReferenceStageComposition } from "@/domain/overlayStudioReference";

export { referenceMotionMatchingPolicy };

export type MotionLayerRole = "background" | "content" | "persistent" | "exclusive";
export type MotionDurationScope = "beat" | "caption" | "segment" | "chapter";

export interface MotionMatchingProfile {
  effectId: string;
  purposeGroup: string;
  purpose: string;
  triggerWhen: string;
  avoidWhen: string;
  distinguishFrom: string;
  parameterGuide: string;
  verticalPolicy: string;
  layerRole: MotionLayerRole;
  durationScope: MotionDurationScope;
  rhythmKeys: string[];
}

export interface MotionParamOverride {
  key: string;
  value: string | number | boolean;
}

export interface MotionTimingCaption {
  startSeconds: number;
  endSeconds: number;
}

type ReferenceMotionMatchingCard = (typeof referenceMotionMatchingCards)[number];
const referenceCards = new Map<string, ReferenceMotionMatchingCard>(
  referenceMotionMatchingCards.map((card) => [card.id, card])
);

const localTriggerRules: Readonly<Record<string, string>> = {
  "poster-wall-3d": "同时展示 2-12 张海报、封面或案例图，并需要透明背景下的空间运镜时使用",
  "image-duet-3d": "恰好两张图片需要并排比较或形成双卡透视关系时使用",
  "motion-zoom": "2-10 个图片或视频需要连续推近并在切换点加强动势时使用",
  "slide-gallery": "2-8 个图片或视频需要横向轮播并逐个聚焦时使用",
  "card-stack": "2-8 个图片或视频需要以叠卡方式逐张翻展时使用",
  "split-reveal": "2-4 个图片或视频需要分栏对照、错峰揭示时使用",
  "background-stripes": "需要低信息量、持续运动的斜向纹理作为整段背景时使用",
  "background-grid": "技术、空间或结构主题需要透视网格作为整段背景时使用",
  "background-dots": "轻量数据或节奏段落需要点阵律动作为整段背景时使用",
  "background-contours": "抽象概念或层级变化需要流动等高线作为整段背景时使用"
};

export const referenceMotionTimingKeys = [
  "times", "stepMs", "holdMs", "wordMs", "swapMs", "spinMs", "scrollMs", "countMs",
  "drawMs", "strikeAtMs", "strikeStepMs", "vetoAt", "moveSec", "tourSec", "pushMs",
  "oldAt", "newAt", "punchAt", "firstAt", "buildAt", "buildStepMs", "paradeAt",
  "paradeStepMs", "startAt", "staggerMs", "lockMs", "itemStepMs", "noteStepMs",
  "chipStepMs", "spotMs", "focusMs", "shiftAtMs", "badgesAt", "subAt", "stopsAt",
  "intoAt", "noteAt", "libAt", "deckAt", "payAt", "leftAt", "rightAt", "dockTimes",
  "cps", "acts", "flipMs", "orbitSec", "periodSec", "wordAt"
] as const;

const mixedContentTimingKeys = new Set<string>(["acts"]);

const mediaParameterPattern = /^(?:camSrc|videoSrc\d*|img\d*|src|tiles|clips)$/;

function rhythmKeys(parameterGuide: string, defaultParams: CompositionParams = {}) {
  return referenceMotionTimingKeys
    .filter((key) => parameterGuide.includes(`\`${key}\``) || Object.hasOwn(defaultParams, key))
    .sort((left, right) => parameterGuide.indexOf(`\`${left}\``) - parameterGuide.indexOf(`\`${right}\``));
}

export function isMotionTimingParameter(key: string) {
  return referenceMotionTimingKeys.some((candidate) => candidate === key) && !mixedContentTimingKeys.has(key);
}

export function allowedAiMotionParameterKeys(effect: CompositionDefinition) {
  const keys = Object.keys(effect.defaultParams ?? {}).filter((key) => (
    !mediaParameterPattern.test(key) && !isMotionTimingParameter(key) && key !== "theme"
  ));
  if (isReferenceStageComposition(effect.id) && !keys.includes("scale")) keys.push("scale");
  return keys;
}

function layerRole(effect: CompositionDefinition, card?: ReferenceMotionMatchingCard): MotionLayerRole {
  const ruleText = `${card?.purposeGroup ?? ""} ${card?.purpose ?? ""} ${card?.triggerWhen ?? ""} ${card?.parameterGuide ?? ""}`;
  if (effect.category === "背景" || effect.recipe.sceneBackground || /氛围底噪|全屏背景板|背景/.test(ruleText)) return "background";
  if (/独占全屏|勿与其他卡同屏/.test(ruleText)) return "exclusive";
  if (/常驻|全程在场|整章/.test(ruleText)) return "persistent";
  return "content";
}

function durationScope(card?: ReferenceMotionMatchingCard): MotionDurationScope {
  const ruleText = `${card?.purposeGroup ?? ""} ${card?.purpose ?? ""} ${card?.triggerWhen ?? ""}`;
  if (/每期一张|视频结尾|全程/.test(ruleText)) return "chapter";
  if (/整章|每章/.test(ruleText)) return "chapter";
  if (/整段|段落|论点|陪跑|15s\+/.test(ruleText)) return "segment";
  if (/时刻|瞬间|1-1\.5s|1\.5-3s|2-3s/.test(ruleText)) return "beat";
  return "caption";
}

function distinction(triggerWhen: string) {
  const comparisons = triggerWhen.match(/(?:比|→|用|只有|要的是|不是).{0,80}`[a-z0-9-]+`/g);
  return comparisons?.join("；") ?? "按触发条件与同用途动效的承载结构选择最贴切的一种";
}

export function motionMatchingProfile(effect: CompositionDefinition): MotionMatchingProfile {
  const card = referenceCards.get(effect.id);
  const purposeGroup = card?.purposeGroup
    ?? (effect.category === "背景" ? "氛围背景" : effect.tags[0] === "Overlay Studio" ? effect.tags[1] ?? effect.category : effect.category);
  const triggerWhen = card?.triggerWhen
    ?? localTriggerRules[effect.id]
    ?? `内容明确符合“${effect.description}”，并出现这些语义之一时使用：${effect.tags.join("、")}`;
  const parameterGuide = card?.parameterGuide
    ?? Object.keys(effect.defaultParams ?? {}).map((key) => `\`${key}\``).join("、");
  return {
    effectId: effect.id,
    purposeGroup,
    purpose: card?.purpose ?? effect.description,
    triggerWhen,
    avoidWhen: effect.category === "数据"
      ? "字幕或文章没有可核验数字时不要使用"
      : layerRole(effect, card) === "background"
        ? "不要把背景当作承载正文的内容卡，不要在同一段叠加多个背景"
        : "只有泛泛过渡、没有对应语义或信息增量时不要使用",
    distinguishFrom: distinction(triggerWhen),
    parameterGuide,
    verticalPolicy: card?.verticalPolicy ?? "按画布安全区自适应",
    layerRole: layerRole(effect, card),
    durationScope: durationScope(card),
    rhythmKeys: rhythmKeys(parameterGuide, effect.defaultParams)
  };
}

function structuredItemCount(text: string) {
  const parts = text.split(/[｜|\n]/u).map((part) => part.trim()).filter(Boolean);
  return Math.max(1, parts.length > 1 ? parts.length - 1 : parts.length);
}

function boundedMilliseconds(value: number) {
  return Math.round(Math.max(150, Math.min(30_000, value)));
}

const millisecondRanges: Readonly<Record<string, readonly [number, number]>> = {
  chipStepMs: [40, 400],
  lockMs: [30, 300],
  staggerMs: [150, 1_200],
  itemStepMs: [400, 3_000],
  noteStepMs: [500, 6_000],
  spotMs: [500, 3_000],
  focusMs: [300, 2_500],
  shiftAtMs: [800, 4_000],
  flipMs: [40, 2_000]
};

function boundedMillisecondsForKey(key: string, value: number) {
  const range = millisecondRanges[key];
  return range
    ? Math.round(Math.max(range[0], Math.min(range[1], value)))
    : boundedMilliseconds(value);
}

function roundedSeconds(value: number, durationSeconds: number) {
  return Number(Math.max(0, Math.min(durationSeconds, value)).toFixed(2));
}

function delimitedItemCount(value: unknown) {
  if (typeof value !== "string") return 0;
  return value.split(/[|｜\n]/u).map((part) => part.trim()).filter(Boolean).length;
}

function characterCount(value: unknown) {
  if (typeof value !== "string") return 0;
  return Array.from(value.replace(/[|｜\n\s]/gu, "")).length;
}

function retimeActs(value: unknown, cueSeconds: readonly number[], durationSeconds: number) {
  if (typeof value !== "string") return value;
  const acts = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!acts.length) return value;
  return acts.map((line, index) => {
    const action = line.replace(/^\s*\d+(?:\.\d+)?\s*\|/u, "").trim();
    const fallback = durationSeconds * index / Math.max(1, acts.length);
    return `${roundedSeconds(cueSeconds[index] ?? fallback, durationSeconds)}|${action}`;
  }).join("\n");
}

function secondsForEvent(effectId: string, key: string, eventOrder: readonly string[], cueSeconds: readonly number[], durationSeconds: number, params: CompositionParams) {
  const authoredOrder: Readonly<Record<string, readonly string[]>> = {
    "studio-build": ["libAt", "deckAt", "payAt"],
    "hand-lift": ["leftAt", "rightAt"]
  };
  const order = authoredOrder[effectId] ?? eventOrder;
  let eventIndex = Math.max(0, order.indexOf(key));
  if (effectId === "replicate-loop") {
    const stopCount = Math.max(1, delimitedItemCount(params.stops));
    eventIndex = key === "intoAt" ? stopCount : key === "noteAt" ? stopCount + 1 : eventIndex;
  } else if (key === "vetoAt" && cueSeconds.length > 1) {
    eventIndex = 1;
  }
  return roundedSeconds(cueSeconds[eventIndex] ?? durationSeconds * eventIndex / Math.max(1, order.length), durationSeconds);
}

/** Turns subtitle anchors into deterministic card timing; AI only decides which line each item belongs to. */
export function compileAiMotionParams(input: {
  effect: CompositionDefinition;
  baseParams: CompositionParams;
  overrides: readonly MotionParamOverride[];
  timingCaptionIndices: readonly number[];
  captions: readonly MotionTimingCaption[];
  startCaptionIndex: number;
  endCaptionIndex: number;
  text: string;
}) {
  const allowedOverrides = new Set(allowedAiMotionParameterKeys(input.effect));
  const params: CompositionParams = { ...input.baseParams };
  for (const override of input.overrides) {
    if (allowedOverrides.has(override.key)) params[override.key] = override.value;
  }
  if (isReferenceStageComposition(input.effect.id) && Object.hasOwn(params, "scale")) {
    const scale = params.scale;
    params.scale = typeof scale === "number" && Number.isFinite(scale)
      ? Math.max(0.3, Math.min(1, scale))
      : 1;
  }

  const profile = motionMatchingProfile(input.effect);
  if (!profile.rhythmKeys.length) return params;
  const start = input.captions[input.startCaptionIndex]?.startSeconds ?? 0;
  const end = input.captions[input.endCaptionIndex]?.endSeconds ?? start;
  const durationSeconds = Math.max(0.1, end - start);
  const cueIndices = [...new Set(input.timingCaptionIndices)]
    .filter((index) => index >= input.startCaptionIndex && index <= input.endCaptionIndex && input.captions[index])
    .sort((left, right) => left - right);
  const inferredCount = structuredItemCount(input.text);
  const cueSeconds = cueIndices.length
    ? cueIndices.map((index) => Math.max(0, input.captions[index].startSeconds - start))
    : Array.from({ length: inferredCount }, (_, index) => durationSeconds * index / inferredCount);
  const intervalMs = boundedMilliseconds(
    cueSeconds.length > 1
      ? (cueSeconds.at(-1)! - cueSeconds[0]) * 1_000 / Math.max(1, cueSeconds.length - 1)
      : durationSeconds * 900 / inferredCount
  );
  const totalMs = boundedMilliseconds(durationSeconds * 1_000);
  const intervalTimingKeys = new Set([
    "stepMs", "holdMs", "wordMs", "swapMs", "spinMs", "strikeStepMs", "buildStepMs",
    "paradeStepMs", "staggerMs", "itemStepMs", "noteStepMs", "spotMs", "focusMs", "flipMs"
  ]);
  const durationMillisecondKeys = new Set(["scrollMs", "countMs", "drawMs", "pushMs"]);
  const durationSecondKeys = new Set(["moveSec", "tourSec", "orbitSec"]);
  const secondEventKeys = new Set([
    "vetoAt", "oldAt", "newAt", "punchAt", "firstAt", "buildAt", "paradeAt", "startAt",
    "badgesAt", "subAt", "intoAt", "noteAt", "libAt", "deckAt", "payAt", "leftAt",
    "rightAt", "wordAt"
  ]);
  const eventOrder = profile.rhythmKeys.filter((key) => secondEventKeys.has(key));

  for (const key of profile.rhythmKeys) {
    if (key === "times") params[key] = cueSeconds.map((value) => Number(value.toFixed(2))).join("|");
    else if (key === "stopsAt") {
      const stopCount = Math.max(1, delimitedItemCount(params.stops));
      params[key] = Array.from({ length: stopCount }, (_, index) => roundedSeconds(
        cueSeconds[index] ?? durationSeconds * index / stopCount,
        durationSeconds
      )).join("|");
    } else if (key === "dockTimes") {
      params[key] = delimitedItemCount(params.notes)
        ? cueSeconds.map((value) => roundedSeconds(value, durationSeconds)).join("|")
        : "";
    } else if (key === "acts") params[key] = retimeActs(params[key], cueSeconds, durationSeconds) as string;
    else if (key === "cps") {
      const count = Math.max(1, characterCount(params.lines) || characterCount(input.text));
      params[key] = Math.max(8, Math.min(60, Math.ceil(count / durationSeconds)));
    } else if (key === "lockMs") {
      const count = Math.max(1, characterCount(params.text) || characterCount(input.text));
      params[key] = boundedMillisecondsForKey(key, durationSeconds * 900 / count);
    } else if (key === "chipStepMs") {
      const count = Math.max(1, Number(params.chips) || delimitedItemCount(params.chips));
      const phaseDurationSeconds = cueSeconds.length > 1 ? Math.max(0.1, cueSeconds[1] - cueSeconds[0]) : durationSeconds * 0.33;
      params[key] = boundedMillisecondsForKey(key, phaseDurationSeconds * 900 / count);
    } else if (intervalTimingKeys.has(key)) params[key] = boundedMillisecondsForKey(key, intervalMs);
    else if (durationMillisecondKeys.has(key)) params[key] = totalMs;
    else if (durationSecondKeys.has(key)) params[key] = Number(durationSeconds.toFixed(2));
    else if (key === "periodSec") params[key] = Number((intervalMs / 1_000).toFixed(2));
    else if (key === "strikeAtMs") params[key] = boundedMilliseconds((cueSeconds[1] ?? cueSeconds[0] ?? durationSeconds * 0.5) * 1_000);
    else if (key === "shiftAtMs") params[key] = boundedMillisecondsForKey(key, (cueSeconds[0] ?? durationSeconds * 0.5) * 1_000);
    else if (secondEventKeys.has(key)) params[key] = secondsForEvent(input.effect.id, key, eventOrder, cueSeconds, durationSeconds, params);
  }
  return params;
}

export function hasReferenceMotionMatchingCard(effectId: string) {
  return referenceCards.has(effectId);
}

export const referenceMotionMatchingCardCount = referenceMotionMatchingCards.length;
