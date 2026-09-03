import type { ComponentType, CSSProperties, ReactNode } from "react";
import { EffectChartCanvas } from "@/components/EffectChartCanvas";
import { measureChartBox } from "@/domain/chartEffects";
import { allEffects, effectById, type EffectDefinition, type EffectRecipe } from "@/domain/effects";
import type { EffectBackdrop, EffectClip, MotionTheme } from "@/domain/project";
import { motionFontFamily } from "@/domain/motionTheme";

export type EffectControl =
  | { kind: "text"; field: "text"; label: string; rows: number }
  | { kind: "color"; field: "color" | "accentColor"; label: string }
  | { kind: "range"; field: "fontSize" | "speed"; label: string; min: number; max: number; step: number; suffix: string };

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
}

export interface ReactEffectDefinition {
  definition: EffectDefinition;
  component: ComponentType<EffectRenderProps>;
  controls: readonly EffectControl[];
}

const commonControls: readonly EffectControl[] = [
  { kind: "text", field: "text", label: "文字", rows: 3 },
  { kind: "color", field: "color", label: "文字颜色" },
  { kind: "color", field: "accentColor", label: "强调色" },
  { kind: "range", field: "fontSize", label: "字号", min: 18, max: 120, step: 1, suffix: "px" },
  { kind: "range", field: "speed", label: "速度", min: 0.25, max: 3, step: 0.05, suffix: "x" }
];

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
  return {
    definition: effectById(effectId),
    component: GenericEffectCard,
    controls: commonControls
  };
}

export function activeReactEffectDefinitions(): ReactEffectDefinition[] {
  return allEffects().map((definition) => ({ definition, component: GenericEffectCard, controls: commonControls }));
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

export function effectCardChromeStyle(clip: Pick<EffectClip, "color" | "accentColor" | "backdrop">, recipe: EffectRecipe, length: (pixels: number, minimum?: number) => string, theme?: MotionTheme): CSSProperties {
  const backdrop: EffectBackdrop | undefined = clip.backdrop;
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
    backgroundColor: backdrop?.enabled ? colorWithOpacity(theme && clip.backdrop?.color === "#111316" ? theme.colors.surface : backdrop.color, backdrop.opacity) : recipe.backgroundOpacity > 0 ? colorWithOpacity(theme?.colors.surface ?? "#111316", recipe.backgroundOpacity) : undefined,
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
