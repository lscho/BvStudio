import type { ComponentType, CSSProperties, ReactNode } from "react";
import { EffectChartCanvas } from "@/components/EffectChartCanvas";
import { measureChartBox } from "@/domain/chartEffects";
import { allEffects, effectById, type EffectDefinition, type EffectParams, type EffectRecipe } from "@/domain/effects";
import type { EffectBackdrop, EffectClip, MotionTheme } from "@/domain/project";
import { motionFontFamily, resolveEffectBackdropColor } from "@/domain/motionTheme";
import { ArgumentBoardCard, CausalChainCard, ConceptMapCard, MythFactCard, QuoteLinesCard } from "@/effects/knowledgeCards";
import { ChecklistCard, EntityChipsCard, PinBoardCard, StatProofCard, VersusCard } from "@/effects/talkingHeadCards";
import {
  BlurTextCard,
  CaptionTrackCard,
  ChapterBarCard,
  FocusCard,
  GrowthCurveCard,
  OdometerCard,
  PunchPillCard,
  QuoteLockupCard,
  RankBarsCard,
  RingMetricCard,
  StepTimelineCard,
  TermCard,
  Terminal3DCard,
  TypeShiftCard,
  UICalloutCard
} from "@/effects/overlayStudioCards";

export type EffectControl =
  | { kind: "text"; field: "text"; label: string; rows: number }
  | { kind: "color"; field: "color" | "accentColor"; label: string }
  | { kind: "range"; field: "fontSize" | "speed"; label: string; min: number; max: number; step: number; suffix: string }
  | { kind: "param-text"; field: string; label: string; rows: number }
  | { kind: "param-range"; field: string; label: string; min: number; max: number; step: number; suffix: string }
  | { kind: "param-toggle"; field: string; label: string }
  | { kind: "param-select"; field: string; label: string; options: readonly { value: string; label: string }[] }
  | { kind: "param-color"; field: string; label: string };

export interface EffectRenderProps {
  effectId: string;
  text: string;
  color: string;
  accentColor: string;
  fontSize: number;
  recipe: EffectRecipe;
  timeUs: number;
  durationUs: number;
  canvasWidth: number;
  canvasHeight?: number;
  params?: EffectParams;
}

export interface ReactEffectDefinition {
  definition: EffectDefinition;
  component: ComponentType<EffectRenderProps>;
  controls: readonly EffectControl[];
  motionDurationUs: number;
}

const commonControls: readonly EffectControl[] = [
  { kind: "text", field: "text", label: "文字", rows: 3 },
  { kind: "color", field: "color", label: "文字颜色" },
  { kind: "color", field: "accentColor", label: "强调色" },
  { kind: "range", field: "fontSize", label: "字号", min: 18, max: 120, step: 1, suffix: "px" },
  { kind: "range", field: "speed", label: "速度", min: 0.25, max: 3, step: 0.05, suffix: "x" }
];

const structuredTextControls: readonly EffectControl[] = commonControls.map((control) => (
  control.kind === "text" ? { ...control, label: "内容（用｜分隔）", rows: 4 } : control
));

const appearanceControls = commonControls.filter((control) => control.kind !== "text");
const themeControl: EffectControl = { kind: "param-select", field: "theme", label: "卡片底色", options: [{ value: "dark", label: "暗底" }, { value: "light", label: "亮底" }] };
const paramControls = (...controls: EffectControl[]): readonly EffectControl[] => [themeControl, ...controls, ...appearanceControls];
const sideOptions = [{ value: "left", label: "左侧" }, { value: "right", label: "右侧" }] as const;
const horizontalPositionOptions = [{ value: "left", label: "左侧" }, { value: "center", label: "居中" }, { value: "right", label: "右侧" }] as const;

interface ComponentRegistration {
  component: ComponentType<EffectRenderProps>;
  controls: readonly EffectControl[];
  motionDurationUs: number;
}

const componentRegistrations: Readonly<Record<string, ComponentRegistration>> = {
  "knowledge-concept-map": { component: ConceptMapCard, controls: structuredTextControls, motionDurationUs: 1_050_000 },
  "knowledge-causal-chain": { component: CausalChainCard, controls: structuredTextControls, motionDurationUs: 1_200_000 },
  "knowledge-argument-board": { component: ArgumentBoardCard, controls: structuredTextControls, motionDurationUs: 1_150_000 },
  "knowledge-myth-fact": { component: MythFactCard, controls: structuredTextControls, motionDurationUs: 950_000 },
  "knowledge-quote-lines": { component: QuoteLinesCard, controls: structuredTextControls, motionDurationUs: 1_550_000 },
  "pin-board": { component: PinBoardCard, controls: paramControls(
    { kind: "param-select", field: "position", label: "落位", options: [{ value: "top-right", label: "右上角" }, { value: "top-left", label: "左上角" }] },
    { kind: "param-text", field: "title", label: "章节标题", rows: 1 },
    { kind: "param-text", field: "subtitle", label: "强调副题", rows: 1 },
    { kind: "param-text", field: "items", label: "要点（用 | 分隔）", rows: 4 },
    { kind: "param-range", field: "stepMs", label: "每条落钉间隔", min: 1000, max: 15000, step: 250, suffix: "ms" }
  ), motionDurationUs: 1_750_000 },
  "checklist": { component: ChecklistCard, controls: paramControls(
    { kind: "param-select", field: "position", label: "落位", options: [{ value: "left", label: "左侧" }, { value: "right", label: "右侧" }, { value: "top-left", label: "左上角" }] },
    { kind: "param-text", field: "title", label: "小标题", rows: 1 },
    { kind: "param-text", field: "items", label: "步骤（用 | 分隔）", rows: 4 },
    { kind: "param-range", field: "checked", label: "已完成到第几步", min: 0, max: 8, step: 1, suffix: "" },
    { kind: "param-range", field: "stepMs", label: "每条间隔", min: 100, max: 8000, step: 100, suffix: "ms" }
  ), motionDurationUs: 1_650_000 },
  "versus-card": { component: VersusCard, controls: paramControls(
    { kind: "param-text", field: "aKicker", label: "左卡小标", rows: 1 },
    { kind: "param-text", field: "aTitle", label: "左卡标题", rows: 1 },
    { kind: "param-text", field: "aSub", label: "左卡说明", rows: 2 },
    { kind: "param-text", field: "bKicker", label: "右卡小标", rows: 1 },
    { kind: "param-text", field: "bTitle", label: "右卡标题", rows: 1 },
    { kind: "param-text", field: "bSub", label: "右卡说明", rows: 2 },
    { kind: "param-select", field: "winner", label: "强调哪边", options: [{ value: "a", label: "左边" }, { value: "b", label: "右边" }, { value: "none", label: "都不" }] }
  ), motionDurationUs: 1_180_000 },
  "entity-chips": { component: EntityChipsCard, controls: paramControls(
    { kind: "param-select", field: "position", label: "落位", options: horizontalPositionOptions },
    { kind: "param-text", field: "chips", label: "名牌（一行一块：light/dark|名称|身份）", rows: 3 },
    { kind: "param-text", field: "note", label: "侧注（上行|下行）", rows: 1 },
    { kind: "param-range", field: "stepMs", label: "逐块滑入间隔", min: 0, max: 1500, step: 100, suffix: "ms" }
  ), motionDurationUs: 1_450_000 },
  "stat-proof": { component: StatProofCard, controls: paramControls(
    { kind: "param-select", field: "position", label: "落位", options: [...horizontalPositionOptions, { value: "top-left", label: "左上角" }, { value: "top-right", label: "右上角" }] },
    { kind: "param-text", field: "kicker", label: "顶部英文小标", rows: 1 },
    { kind: "param-text", field: "kickerZh", label: "中文小注", rows: 1 },
    { kind: "param-range", field: "value", label: "目标数字", min: -999999, max: 999999, step: 0.1, suffix: "" },
    { kind: "param-text", field: "prefix", label: "数字前缀", rows: 1 },
    { kind: "param-text", field: "suffix", label: "数字后缀", rows: 1 },
    { kind: "param-text", field: "footEn", label: "英文注脚", rows: 1 },
    { kind: "param-text", field: "footZh", label: "中文注脚", rows: 1 },
    { kind: "param-range", field: "countMs", label: "计数时长", min: 400, max: 5000, step: 100, suffix: "ms" }
  ), motionDurationUs: 1_300_000 },
  "quote-lockup": { component: QuoteLockupCard, controls: paramControls(
    { kind: "param-text", field: "quote", label: "金句（用 | 分行）", rows: 4 },
    { kind: "param-text", field: "author", label: "署名", rows: 1 }
  ), motionDurationUs: 1_350_000 },
  "step-timeline": { component: StepTimelineCard, controls: paramControls(
    { kind: "param-text", field: "title", label: "标题（*关键词*高亮）", rows: 2 },
    { kind: "param-text", field: "steps", label: "章节（用 | 分隔）", rows: 4 },
    { kind: "param-range", field: "revealed", label: "显示章节数", min: 0, max: 6, step: 1, suffix: "" }
  ), motionDurationUs: 1_700_000 },
  "rank-bars": { component: RankBarsCard, controls: paramControls(
    { kind: "param-text", field: "title", label: "小标题", rows: 1 },
    { kind: "param-text", field: "rows", label: "数据（名称,数值；用 | 分隔）", rows: 4 },
    { kind: "param-text", field: "suffix", label: "后缀单位", rows: 1 }
  ), motionDurationUs: 1_900_000 },
  "punch-pill": { component: PunchPillCard, controls: paramControls(
    { kind: "param-text", field: "pillText", label: "金句文字", rows: 2 }
  ), motionDurationUs: 420_000 },
  "term-card": { component: TermCard, controls: paramControls(
    { kind: "param-text", field: "en", label: "英文 / 拼音", rows: 1 },
    { kind: "param-text", field: "term", label: "术语", rows: 1 },
    { kind: "param-text", field: "definition", label: "一句话定义", rows: 3 }
  ), motionDurationUs: 700_000 },
  "terminal-3d": { component: Terminal3DCard, controls: paramControls(
    { kind: "param-text", field: "file", label: "标题栏文件名", rows: 1 },
    { kind: "param-text", field: "lines", label: "命令行（用 | 分隔）", rows: 5 },
    { kind: "param-range", field: "cps", label: "打字速度", min: 8, max: 60, step: 2, suffix: " 字/秒" }
  ), motionDurationUs: 4_500_000 },
  "ring-metric": { component: RingMetricCard, controls: paramControls(
    { kind: "param-text", field: "kicker", label: "小标签", rows: 1 },
    { kind: "param-range", field: "value", label: "数值", min: 0, max: 1000, step: 0.1, suffix: "" },
    { kind: "param-range", field: "max", label: "满值", min: 1, max: 1000, step: 1, suffix: "" },
    { kind: "param-range", field: "decimals", label: "小数位", min: 0, max: 2, step: 1, suffix: "" },
    { kind: "param-text", field: "unit", label: "单位", rows: 1 },
    { kind: "param-text", field: "label", label: "说明文字", rows: 2 }
  ), motionDurationUs: 1_300_000 },
  "ui-callout": { component: UICalloutCard, controls: paramControls(
    { kind: "param-text", field: "label", label: "标签文字", rows: 2 },
    { kind: "param-range", field: "ringW", label: "圈宽", min: 80, max: 800, step: 10, suffix: "px" },
    { kind: "param-range", field: "ringH", label: "圈高", min: 60, max: 600, step: 10, suffix: "px" },
    { kind: "param-select", field: "side", label: "标签方向", options: sideOptions }
  ), motionDurationUs: 1_000_000 },
  "type-shift": { component: TypeShiftCard, controls: paramControls(
    { kind: "param-text", field: "lines", label: "行（| 分隔；* 开头为大标）", rows: 5 },
    { kind: "param-range", field: "shiftAtMs", label: "重排时间", min: 800, max: 4000, step: 100, suffix: "ms" }
  ), motionDurationUs: 2_200_000 },
  "blur-text": { component: BlurTextCard, controls: paramControls(
    { kind: "param-text", field: "blurText", label: "词块（用 | 分隔）", rows: 4 },
    { kind: "param-range", field: "staggerMs", label: "每块间隔", min: 150, max: 1200, step: 30, suffix: "ms" }
  ), motionDurationUs: 2_200_000 },
  "odometer": { component: OdometerCard, controls: paramControls(
    { kind: "param-text", field: "kicker", label: "小标签", rows: 1 },
    { kind: "param-range", field: "value", label: "目标整数", min: 0, max: 99_999, step: 1, suffix: "" },
    { kind: "param-text", field: "unit", label: "单位", rows: 1 },
    { kind: "param-text", field: "label", label: "说明", rows: 2 }
  ), motionDurationUs: 1_350_000 },
  "focus-card": { component: FocusCard, controls: paramControls(
    { kind: "param-select", field: "bg", label: "底色", options: [{ value: "cream", label: "米色" }, { value: "mist", label: "雾白" }, { value: "dark", label: "暗色" }] },
    { kind: "param-select", field: "side", label: "人物框位置", options: sideOptions },
    { kind: "param-text", field: "items", label: "要点（用 | 分隔）", rows: 4 },
    { kind: "param-range", field: "stepMs", label: "每条间隔", min: 200, max: 8000, step: 100, suffix: "ms" },
    { kind: "param-toggle", field: "showRing", label: "显示人物落位框" },
    { kind: "param-range", field: "camDX", label: "人物框水平移动", min: -1100, max: 1100, step: 10, suffix: "px" },
    { kind: "param-range", field: "camDY", label: "人物框垂直移动", min: -400, max: 600, step: 10, suffix: "px" },
    { kind: "param-range", field: "camW", label: "人物框宽", min: 300, max: 1200, step: 10, suffix: "px" },
    { kind: "param-range", field: "camH", label: "人物框高", min: 300, max: 1000, step: 10, suffix: "px" }
  ), motionDurationUs: 3_600_000 },
  "chapter-bar": { component: ChapterBarCard, controls: paramControls(
    { kind: "param-text", field: "chapters", label: "章节表（名称 起始秒；用 | 分隔）", rows: 5 },
    { kind: "param-toggle", field: "showProgress", label: "显示进度" },
    { kind: "param-select", field: "progressMode", label: "进度形态", options: [{ value: "fill", label: "整条推进" }, { value: "line", label: "当前章细线" }] }
  ), motionDurationUs: 320_000 },
  "caption-track": { component: CaptionTrackCard, controls: paramControls(
    { kind: "param-text", field: "lines", label: "字幕表（起始|结束|中文|英文）", rows: 8 },
    { kind: "param-toggle", field: "showEnglish", label: "显示英文小字" },
    { kind: "param-toggle", field: "strokeOn", label: "启用文字描边" },
    { kind: "param-range", field: "strokeWidth", label: "描边宽度", min: 1, max: 8, step: 0.5, suffix: "px" },
    { kind: "param-color", field: "strokeColor", label: "描边颜色" }
  ), motionDurationUs: 260_000 },
  "growth-curve": { component: GrowthCurveCard, controls: paramControls(
    { kind: "param-text", field: "kicker", label: "顶部标签", rows: 1 },
    { kind: "param-text", field: "kickerZh", label: "中文小注", rows: 1 },
    { kind: "param-text", field: "points", label: "数据点（标签 数值；用 | 分隔）", rows: 4 },
    { kind: "param-text", field: "unit", label: "峰值单位", rows: 1 },
    { kind: "param-range", field: "drawMs", label: "曲线画完时间", min: 600, max: 5000, step: 100, suffix: "ms" },
    { kind: "param-text", field: "caption", label: "数据口径 / 出处", rows: 2 }
  ), motionDurationUs: 5_100_000 }
};

function revealProgress(timeUs: number, speed: number, durationSeconds = 0.45) {
  return Math.max(0, Math.min(1, timeUs / Math.max(1, durationSeconds * 1_000_000 / Math.max(0.1, speed))));
}

function linesFor(text: string) {
  const explicit = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit;
  return text.split(/[；;。]/u).map((line) => line.trim()).filter(Boolean);
}

function staggeredLines(lines: string[], progress: number): ReactNode {
  return lines.map((line, index) => {
    const start = index / Math.max(1, lines.length) * 0.58;
    const local = Math.max(0, Math.min(1, (progress - start) / 0.42));
    const eased = 1 - (1 - local) ** 3;
    return <span className="react-effect-line" key={`${index}-${line}`} style={{ opacity: eased, transform: `translateY(${(1 - eased) * 0.45}em)` }}>{line}</span>;
  });
}

function GenericEffectCard(props: EffectRenderProps) {
  if (props.recipe.chart) {
    const durationUs = Math.max(50_000, (props.recipe.chart.durationSeconds ?? 1.2) * 1_000_000);
    const progress = Math.max(0, Math.min(1, props.timeUs / durationUs));
    const width = measureChartBox(props.recipe.chart, props.fontSize).width / props.canvasWidth * 100;
    return <EffectChartCanvas spec={props.recipe.chart} caption={props.text} textColor={props.color} accentColor={props.accentColor} fontSize={props.fontSize} progress={progress} cssWidth={`${width}cqw`} />;
  }
  const progress = revealProgress(props.timeUs, 1);
  if (props.effectId.includes("bullet") || props.effectId.includes("steps")) {
    return <span className="react-effect-lines">{staggeredLines(linesFor(props.text), progress)}</span>;
  }
  if (props.effectId.includes("quote")) {
    return <span className="react-effect-quote"><i aria-hidden="true">“</i>{staggeredLines(linesFor(props.text), progress)}</span>;
  }
  if (props.effectId.includes("compare")) {
    const sides = props.text.split(/\s+(?:vs\.?|VS\.?)\s+|[｜|]/u).map((part) => part.trim()).filter(Boolean);
    if (sides.length >= 2) return <span className="react-effect-compare"><b>{sides[0]}</b><i>VS</i><b>{sides.slice(1).join(" ")}</b></span>;
  }
  return <span className="react-effect-text">{props.text}</span>;
}

export function reactEffectDefinition(effectId: string): ReactEffectDefinition {
  const registration = componentRegistrations[effectId];
  return {
    definition: effectById(effectId),
    component: registration?.component ?? GenericEffectCard,
    controls: registration?.controls ?? commonControls,
    motionDurationUs: registration?.motionDurationUs ?? 0
  };
}

export function activeReactEffectDefinitions(): ReactEffectDefinition[] {
  return allEffects().map((definition) => reactEffectDefinition(definition.id));
}

export function EffectCardContent(props: EffectRenderProps) {
  const Component = reactEffectDefinition(props.effectId).component;
  return <Component {...props} />;
}

export function effectControlsFor(clip: EffectClip): readonly EffectControl[] {
  return reactEffectDefinition(clip.effectId).controls.map((control) => (
    control.kind === "text" && clip.recipe?.chart ? { ...control, label: "说明文字（可留空）" } : control
  ));
}

export function reactEffectMotionDurationUs(effectId: string) {
  return reactEffectDefinition(effectId).motionDurationUs;
}

export function usesComponentChrome(effectId: string) {
  return Object.hasOwn(componentRegistrations, effectId) && !effectId.startsWith("knowledge-");
}

export function effectCardChromeStyle(clip: Pick<EffectClip, "color" | "accentColor" | "backdrop">, recipe: EffectRecipe, length: (pixels: number, minimum?: number) => string, theme?: MotionTheme, componentOwnedChrome = false): CSSProperties {
  const backdrop: EffectBackdrop | undefined = clip.backdrop;
  if (componentOwnedChrome && !backdrop?.enabled) {
    return {
      color: clip.color,
      padding: 0,
      borderWidth: 0,
      borderRadius: 0,
      background: "transparent",
      fontFamily: theme ? motionFontFamily(theme) : undefined,
      "--effect-accent": clip.accentColor
    } as CSSProperties;
  }
  const frameBorderWidth = recipe.layout === "frame" && recipe.borderWidth > 0 ? length(recipe.borderWidth, 1) : undefined;
  return {
    color: recipe.layout === "number" ? clip.accentColor : clip.color,
    padding: backdrop?.enabled ? `${length(backdrop.paddingY, 2)} ${length(backdrop.paddingX, 2)}` : `${length(recipe.paddingY, 2)} ${length(recipe.paddingX, 2)}`,
    borderTopWidth: frameBorderWidth,
    borderRightWidth: frameBorderWidth,
    borderBottomWidth: frameBorderWidth,
    borderLeftWidth: recipe.layout === "panel" ? length(Math.max(2, recipe.borderWidth), 1) : frameBorderWidth,
    borderColor: clip.accentColor,
    borderRadius: theme?.style === "editorial" ? length(Math.min(4, backdrop?.enabled ? backdrop.radius : recipe.borderRadius)) : backdrop?.enabled ? length(backdrop.radius) : length(recipe.borderRadius),
    backgroundColor: backdrop?.enabled ? colorWithOpacity(theme ? resolveEffectBackdropColor(clip.backdrop, theme) : backdrop.color, backdrop.opacity) : recipe.backgroundOpacity > 0 ? colorWithOpacity(theme?.colors.surface ?? "#111316", recipe.backgroundOpacity) : undefined,
    backdropFilter: backdrop?.enabled && backdrop.blur > 0 ? `blur(${length(backdrop.blur)})` : undefined,
    fontFamily: theme ? motionFontFamily(theme) : undefined,
    boxShadow: theme?.skin === "light" && backdrop?.enabled ? `0 ${length(10)} ${length(28)} rgb(0 0 0 / 0.16)` : undefined,
    "--effect-accent": clip.accentColor
  } as CSSProperties;
}

function colorWithOpacity(color: string, opacity: number) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(color);
  if (!match) return color;
  return `rgb(${Number.parseInt(match[1], 16)} ${Number.parseInt(match[2], 16)} ${Number.parseInt(match[3], 16)} / ${Math.max(0, Math.min(1, opacity))})`;
}
