import { scaleLinear } from "d3-scale";
import { arc as createArc, area as createArea, curveMonotoneX, line as createLine } from "d3-shape";
import type { ChartSpec } from "@/domain/effects";

/**
 * Deterministic data-driven motion graphics. Every function here is a pure
 * function of `(spec, progress)` so the editor preview scrubbing and the
 * frame-sequence export produce identical pixels. Nothing in this module
 * reads wall-clock time or random sources.
 */

export interface ChartTheme {
  textColor: string;
  accentColor: string;
}

export interface ChartBox {
  width: number;
  height: number;
}

export const CHART_EASING = "cubic-out" as const;

const MAX_BARS = 5;
const MAX_POINTS = 24;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function cubicOut(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const channel = value.length === 6 ? Number.parseInt(value, 16) : 0x888888;
  const red = (channel >> 16) & 255;
  const green = (channel >> 8) & 255;
  const blue = channel & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function formatChartValue(value: number, decimals = 0): string {
  const fixed = Math.abs(value) < 1e-9 ? (0).toFixed(decimals) : value.toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** Nice axis ceiling: rounds up to 1/2/2.5/5×10^k so bars get breathing room. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (value <= base * factor * 1.000_001) return base * factor;
  }
  return base * 10;
}

export function measureChartBox(spec: ChartSpec, fontSize: number): ChartBox {
  const size = Math.max(10, fontSize);
  if (spec.kind === "counter") {
    const digits = formatChartValue(spec.endValue ?? 100, spec.decimals ?? 0).length + (spec.prefix ?? "").length + (spec.suffix ?? "").length;
    return { width: Math.max(size * 5.8, size * (Math.min(digits, 18) * 0.62 + 2)), height: size * 2.65 };
  }
  if (spec.kind === "donut") return { width: size * 8.6, height: size * 5.6 };
  return { width: size * 9.6, height: size * 5.7 };
}

interface Insets {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function insetsFor(fontSize: number, hasCaption: boolean, needsLegendSpace: boolean): Insets {
  const size = Math.max(8, fontSize);
  return {
    left: size * 0.58,
    right: size * 0.58,
    top: size * (hasCaption ? 1.45 : 0.58),
    bottom: size * (needsLegendSpace ? 1.28 : 0.75)
  };
}

function seriesOf(spec: ChartSpec, limit: number): number[] {
  return (spec.series ?? []).slice(0, limit).map((value) => Number.isFinite(value) ? value : 0);
}

// ---------------------------------------------------------------- counter ---

export function counterValueAt(spec: ChartSpec, progress: number): number {
  const from = spec.startValue ?? 0;
  const series = spec.series ?? [];
  const to = spec.endValue ?? (series.length ? series.reduce((sum, value) => sum + value, 0) : 100);
  return lerp(from, to, cubicOut(clamp01(progress)));
}

// ------------------------------------------------------------------- bars ---

export interface BarGeometry {
  x: number;
  y: number;
  /** Pixel width after the staggered reveal. */
  width: number;
  maxWidth: number;
  height: number;
  bandWidth: number;
  value: number;
  /** 0..1 fill amount after per-bar stagger easing. */
  fill: number;
}

export function barGeometryAt(
  box: ChartBox,
  spec: ChartSpec,
  fontSize: number,
  progress: number,
  hasCaption = false
): { bars: BarGeometry[]; comparison: BarGeometry[]; floorY: number; grid: { y: number; value: number }[]; maxY: number; labelSize: number } {
  const values = seriesOf(spec, MAX_BARS);
  const count = Math.max(1, values.length);
  const compare = (spec.comparison ?? []).slice(0, MAX_BARS);
  const hasCompare = compare.length > 0;
  const size = Math.max(8, fontSize);
  const pads = insetsFor(size, hasCaption, false);
  const labelSize = size * 0.48;
  const labelColumn = Math.min(box.width * 0.25, size * 2.25);
  const valueColumn = Math.min(box.width * 0.19, size * 1.75);
  const plotLeft = pads.left + labelColumn;
  const plotRight = box.width - pads.right - valueColumn;
  const plotWidth = Math.max(10, plotRight - plotLeft);
  const plotHeight = Math.max(10, box.height - pads.top - pads.bottom);
  const floorY = pads.top + plotHeight;
  const maxY = niceMax(Math.max(spec.maxY ?? 0, ...values, ...(hasCompare ? compare : [0])) || 1);
  const scale = scaleLinear().domain([0, maxY]).range([0, plotWidth]);
  const bandWidth = plotHeight / count;
  const barHeight = Math.max(3, Math.min(size * 0.28, bandWidth * 0.32));
  const lastStagger = 0.42;
  const build = (data: number[], comparisonRow: boolean) => data.map((value, index) => {
    const delay = count > 1 ? index / (count - 1) * lastStagger : 0;
    const fill = cubicOut(clamp01((clamp01(progress) - delay) / (1 - lastStagger)));
    const width = scale(Math.max(0, value)) * fill;
    const rowCenter = pads.top + bandWidth * (index + 0.5);
    return {
      x: plotLeft,
      y: rowCenter + (comparisonRow ? barHeight * 0.4 : -barHeight * 0.5),
      width,
      maxWidth: plotWidth,
      height: comparisonRow ? Math.max(2, barHeight * 0.24) : barHeight,
      bandWidth,
      value,
      fill
    };
  });
  return { bars: build(values, false), comparison: hasCompare ? build(compare, true) : [], floorY, grid: [], maxY, labelSize };
}

// ------------------------------------------------------------------ donut ---

export interface DonutSlice {
  startIndex: number;
  endIndex: number;
  value: number;
  share: number;
}

export function donutGeometryAt(box: ChartBox, spec: ChartSpec, fontSize: number, progress: number): {
  slices: DonutSlice[];
  centerValue: number;
  centerX: number;
  centerY: number;
  legendX: number;
  radius: number;
  thickness: number;
} {
  const values = seriesOf(spec, 8).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const sweep = cubicOut(clamp01(clamp01(progress) / 0.82)) * Math.PI * 2;
  let cursor = 0;
  const gap = values.length > 1 ? 0.028 : 0;
  const slices = values.map((value) => {
    const full = value / total * Math.PI * 2;
    const startIndex = cursor + gap / 2;
    const visibleEnd = Math.min(cursor + full, Math.max(startIndex, sweep));
    const slice = { startIndex, endIndex: Math.max(startIndex, visibleEnd - gap / 2), value, share: value / total };
    cursor += full;
    return slice;
  });
  const size = Math.max(8, fontSize);
  const hasCaption = true;
  const centerX = box.width * 0.3;
  const centerY = box.height * (hasCaption ? 0.59 : 0.5);
  const radius = Math.min(box.width * 0.22, box.height * 0.32);
  const target = spec.endValue ?? Math.max(...values, 0) / total * 100;
  const centerValue = lerp(spec.startValue ?? 0, target, cubicOut(clamp01(progress)));
  return {
    slices,
    centerValue,
    centerX,
    centerY,
    legendX: centerX + radius + size * 0.8,
    radius: Math.max(radius, size * 0.8),
    thickness: Math.max(size * 0.32, radius * 0.28)
  };
}

// ------------------------------------------------------------------- line ---

export interface LineGeometry {
  points: { x: number; y: number }[];
  /** Cumulative traveled pixel distance along the path. */
  traveled: number;
  segmentLengths: number[];
  revealedIndex: number;
}

export function lineGeometryAt(box: ChartBox, spec: ChartSpec, fontSize: number, progress: number, hasCaption = false): LineGeometry & { maxY: number; axisY: number; labelSize: number } {
  const values = seriesOf(spec, MAX_POINTS);
  const count = Math.max(2, values.length);
  const size = Math.max(8, fontSize);
  const pads = insetsFor(size, hasCaption, false);
  const maxY = niceMax(Math.max(spec.maxY ?? 0, ...values) || 1);
  const xScale = scaleLinear().domain([0, count - 1]).range([pads.left, box.width - pads.right]);
  const yScale = scaleLinear().domain([0, maxY]).range([box.height - pads.bottom, pads.top]);
  const points = Array.from({ length: Math.min(count, values.length || 2) }, (_, index) => ({
    x: xScale(index),
    y: yScale(values[index] ?? 0)
  }));
  const segmentLengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0) || 1;
  const traveled = totalLength * cubicOut(clamp01(clamp01(progress) / 0.78));
  let revealedIndex = 0;
  let remaining = traveled;
  while (revealedIndex < segmentLengths.length && remaining >= segmentLengths[revealedIndex]) {
    remaining -= segmentLengths[revealedIndex];
    revealedIndex += 1;
  }
  return { points, traveled, segmentLengths, revealedIndex, maxY, axisY: box.height - pads.bottom, labelSize: size * 0.6 };
}

// ------------------------------------------------------------------ paint ---

function outlinedText(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
}

function roundRectFill(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, Math.max(0, width), Math.max(0, height), Math.min(radius, height / 2));
  context.fill();
}

/**
 * Paints one animation frame of the chart onto an already-sized 2D context.
 * The caller owns background chrome (panel/frame/highlight styling).
 */
export function drawChartFrame(
  context: CanvasRenderingContext2D,
  box: ChartBox,
  spec: ChartSpec,
  theme: ChartTheme,
  options: { caption?: string; fontSize: number },
  progress: number
): void {
  const size = Math.max(8, options.fontSize);
  context.save();
  context.lineJoin = "round";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${size}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
  if (options.caption) {
    context.fillStyle = theme.accentColor;
    roundRectFill(context, size * 0.36, size * 0.42, size * 0.11, size * 0.56, size * 0.06);
    context.textAlign = "left";
    context.fillStyle = hexAlpha(theme.textColor, 0.82);
    context.font = `700 ${size * 0.48}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
    context.fillText(options.caption.slice(0, 28), size * 0.65, size * 0.7, box.width - size * 1.05);
    context.textAlign = "center";
  }
  if (spec.kind === "counter") drawCounter(context, box, spec, theme, size, progress);
  else if (spec.kind === "bar") drawBars(context, box, spec, theme, size, progress, Boolean(options.caption));
  else if (spec.kind === "donut") drawDonut(context, box, spec, theme, size, progress);
  else drawLine(context, box, spec, theme, size, progress, Boolean(options.caption));
  context.restore();
}

function drawCounter(context: CanvasRenderingContext2D, box: ChartBox, spec: ChartSpec, theme: ChartTheme, size: number, progress: number) {
  const decimals = Math.max(0, Math.min(4, spec.decimals ?? 0));
  const body = formatChartValue(counterValueAt(spec, progress), decimals);
  const suffix = `${spec.suffix ?? ""}${spec.unit && !spec.suffix ? spec.unit : ""}`;
  const prefix = spec.prefix ?? "";
  const mainFont = `800 ${size * 1.18}px Inter, sans-serif`;
  const sideFont = `700 ${size * 0.48}px Inter, sans-serif`;
  const middleY = box.height * 0.59;
  context.font = sideFont;
  const prefixWidth = context.measureText(prefix).width;
  const suffixWidth = context.measureText(suffix).width;
  context.font = mainFont;
  const bodyWidth = context.measureText(body).width;
  const totalWidth = prefixWidth + bodyWidth + suffixWidth;
  let cursorX = box.width / 2 - totalWidth / 2;
  context.textAlign = "left";
  context.lineWidth = Math.max(1.5, size * 0.045);
  context.strokeStyle = "rgba(0, 0, 0, 0.42)";
  context.fillStyle = theme.textColor;
  context.font = sideFont;
  if (prefix) outlinedText(context, prefix, cursorX, middleY);
  cursorX += prefixWidth;
  context.font = mainFont;
  context.fillStyle = theme.accentColor;
  outlinedText(context, body, cursorX, middleY);
  cursorX += bodyWidth;
  context.font = sideFont;
  context.fillStyle = theme.textColor;
  if (suffix) outlinedText(context, suffix, cursorX, middleY);
  context.fillStyle = hexAlpha(theme.accentColor, 0.28);
  roundRectFill(context, box.width * 0.16, box.height * 0.82, box.width * 0.68, Math.max(2, size * 0.08), size * 0.04);
  context.fillStyle = theme.accentColor;
  roundRectFill(context, box.width * 0.16, box.height * 0.82, box.width * 0.68 * cubicOut(clamp01(progress)), Math.max(2, size * 0.08), size * 0.04);
}

function drawBars(context: CanvasRenderingContext2D, box: ChartBox, spec: ChartSpec, theme: ChartTheme, size: number, progress: number, hasCaption: boolean) {
  const geo = barGeometryAt(box, spec, size, progress, hasCaption);
  const categories = (spec.categories ?? []).slice(0, MAX_BARS);
  const maxValue = Math.max(...geo.bars.map((bar) => bar.value), 0);
  for (const [index, bar] of geo.bars.entries()) {
    const centerY = bar.y + bar.height / 2;
    context.textAlign = "right";
    context.font = `650 ${geo.labelSize}px Inter, "PingFang SC", sans-serif`;
    context.fillStyle = hexAlpha(theme.textColor, 0.72);
    context.fillText((categories[index] ?? `项目 ${index + 1}`).slice(0, 7), bar.x - size * 0.28, centerY, size * 2.05);

    context.fillStyle = hexAlpha(theme.textColor, 0.12);
    roundRectFill(context, bar.x, bar.y, bar.maxWidth, bar.height, bar.height / 2);
    if (bar.fill < 0.001) continue;
    context.fillStyle = bar.value === maxValue ? theme.accentColor : hexAlpha(theme.accentColor, 0.72);
    roundRectFill(context, bar.x, bar.y, bar.width, bar.height, bar.height / 2);

    const comparison = geo.comparison[index];
    if (comparison?.fill > 0.001) {
      context.fillStyle = hexAlpha(theme.textColor, 0.46);
      roundRectFill(context, comparison.x, comparison.y, comparison.width, comparison.height, comparison.height / 2);
    }

    context.globalAlpha = clamp01((bar.fill - 0.68) / 0.32);
    context.textAlign = "left";
    context.font = `800 ${geo.labelSize}px Inter, sans-serif`;
    context.fillStyle = theme.textColor;
    context.fillText(`${formatChartValue(bar.value)}${spec.unit ?? ""}`, bar.x + bar.maxWidth + size * 0.28, centerY, size * 1.6);
    context.globalAlpha = 1;
  }
}

function drawDonut(context: CanvasRenderingContext2D, box: ChartBox, spec: ChartSpec, theme: ChartTheme, size: number, progress: number) {
  const geo = donutGeometryAt(box, spec, size, progress);
  const cx = geo.centerX;
  const cy = geo.centerY;
  context.lineCap = "round";
  context.strokeStyle = hexAlpha(theme.textColor, 0.12);
  context.lineWidth = geo.thickness;
  context.beginPath();
  context.arc(cx, cy, geo.radius - geo.thickness / 2, 0, Math.PI * 2);
  context.stroke();
  const palette = [theme.accentColor, "#65b8ff", "#f4c95d", "#70d6a6", "#f18f7a"];
  const arc = createArc<DonutSlice>()
    .innerRadius(geo.radius - geo.thickness)
    .outerRadius(geo.radius)
    .cornerRadius(geo.thickness * 0.24)
    .startAngle((slice) => slice.startIndex)
    .endAngle((slice) => slice.endIndex)
    .context(context);
  geo.slices.forEach((slice, index) => {
    if (slice.endIndex - slice.startIndex < 0.0015) return;
    context.fillStyle = palette[index % palette.length];
    context.beginPath();
    context.save();
    context.translate(cx, cy);
    arc(slice);
    context.fill();
    context.restore();
  });
  const decimals = Math.max(0, Math.min(4, spec.decimals ?? 0));
  context.fillStyle = theme.textColor;
  context.font = `800 ${size * 0.76}px Inter, sans-serif`;
  context.fillText(formatChartValue(geo.centerValue, decimals), cx, cy - size * 0.12);
  const unit = spec.suffix ?? spec.unit ?? "%";
  if (unit) {
    context.font = `700 ${size * 0.36}px Inter, sans-serif`;
    context.fillStyle = hexAlpha(theme.textColor, 0.66);
    context.fillText(unit, cx, cy + size * 0.46);
  }
  const categories = (spec.categories ?? []).slice(0, 4);
  const values = seriesOf(spec, 4).filter((value) => value > 0);
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const legendTop = size * 1.42;
  const legendStep = Math.min(size * 0.82, (box.height - legendTop - size * 0.3) / Math.max(1, values.length));
  values.forEach((value, index) => {
    const y = legendTop + legendStep * (index + 0.5);
    context.fillStyle = palette[index % palette.length];
    roundRectFill(context, geo.legendX, y - size * 0.1, size * 0.2, size * 0.2, size * 0.1);
    context.textAlign = "left";
    context.font = `650 ${size * 0.4}px Inter, "PingFang SC", sans-serif`;
    context.fillStyle = hexAlpha(theme.textColor, 0.72);
    context.fillText((categories[index] ?? `项目 ${index + 1}`).slice(0, 7), geo.legendX + size * 0.38, y, size * 1.65);
    context.textAlign = "right";
    context.font = `800 ${size * 0.42}px Inter, sans-serif`;
    context.fillStyle = theme.textColor;
    context.fillText(`${formatChartValue(value / total * 100)}%`, box.width - size * 0.4, y, size * 1.15);
  });
}

function drawLine(context: CanvasRenderingContext2D, box: ChartBox, spec: ChartSpec, theme: ChartTheme, size: number, progress: number, hasCaption: boolean) {
  const geo = lineGeometryAt(box, spec, size, progress, hasCaption);
  if (geo.points.length < 2) return;
  context.strokeStyle = hexAlpha(theme.textColor, 0.1);
  context.lineWidth = 1;
  for (const ratio of [0.33, 0.66]) {
    const y = size * (hasCaption ? 1.42 : 0.58) + (geo.axisY - size * (hasCaption ? 1.42 : 0.58)) * ratio;
    context.beginPath();
    context.moveTo(size * 0.58, y);
    context.lineTo(box.width - size * 0.58, y);
    context.stroke();
  }

  let visibleTail = geo.points[geo.revealedIndex];
  if (visibleTail && geo.segmentLengths[geo.revealedIndex]) {
    const remainingTotal = geo.traveled - geo.segmentLengths.slice(0, geo.revealedIndex).reduce((sum, length) => sum + length, 0);
    const next = geo.points[geo.revealedIndex + 1];
    const prev = geo.points[geo.revealedIndex];
    const span = geo.segmentLengths[geo.revealedIndex] || 1;
    const ratio = clamp01(remainingTotal / span);
    visibleTail = { x: lerp(prev.x, next.x, ratio), y: lerp(prev.y, next.y, ratio) };
  }

  const outline = [...geo.points.slice(0, geo.revealedIndex + 1), visibleTail];
  if (outline.length >= 2) {
    const area = createArea<{ x: number; y: number }>()
      .x((point) => point.x)
      .y0(geo.axisY)
      .y1((point) => point.y)
      .curve(curveMonotoneX)
      .context(context);
    context.beginPath();
    area(outline);
    const gradient = context.createLinearGradient(0, size * 1.2, 0, geo.axisY);
    gradient.addColorStop(0, hexAlpha(theme.accentColor, 0.28));
    gradient.addColorStop(1, hexAlpha(theme.accentColor, 0.015));
    context.fillStyle = gradient;
    context.fill();

    const line = createLine<{ x: number; y: number }>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(curveMonotoneX)
      .context(context);
    context.beginPath();
    line(outline);
    context.strokeStyle = theme.accentColor;
    context.lineCap = "round";
    context.lineWidth = Math.max(2, size * 0.1);
    context.stroke();
  }

  geo.points.forEach((point, index) => {
    if (index <= geo.revealedIndex) {
      context.fillStyle = index === geo.points.length - 1 ? theme.accentColor : hexAlpha(theme.textColor, 0.72);
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1.8, size * 0.07), 0, Math.PI * 2);
      context.fill();
    }
  });

  const done = clamp01(progress) > 0.9;
  if (done) {
    const last = geo.points.at(-1)!;
    const decimals = Math.max(0, Math.min(4, spec.decimals ?? 0));
    const label = `${formatChartValue(spec.series?.at(-1) ?? 0, decimals)}${spec.unit ?? ""}`;
    context.font = `800 ${geo.labelSize}px Inter, sans-serif`;
    const badgeWidth = Math.min(size * 2.2, context.measureText(label).width + size * 0.48);
    const badgeHeight = size * 0.68;
    const badgeX = Math.min(box.width - size * 0.35 - badgeWidth, Math.max(size * 0.35, last.x - badgeWidth * 0.5));
    const badgeY = Math.max(size * (hasCaption ? 1.2 : 0.3), last.y - size * 0.95);
    context.fillStyle = theme.accentColor;
    roundRectFill(context, badgeX, badgeY, badgeWidth, badgeHeight, size * 0.15);
    context.textAlign = "center";
    context.fillStyle = "#ffffff";
    context.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
  }

  const categories = (spec.categories ?? []).slice(0, MAX_POINTS);
  if (categories.length) {
    context.font = `600 ${geo.labelSize}px Inter, sans-serif`;
    context.fillStyle = hexAlpha(theme.textColor, 0.58);
    context.textAlign = "left";
    context.fillText(categories[0].slice(0, 7), geo.points[0].x, geo.axisY + geo.labelSize * 0.72, size * 1.8);
    context.textAlign = "right";
    context.fillText(categories.at(-1)!.slice(0, 7), geo.points.at(-1)!.x, geo.axisY + geo.labelSize * 0.72, size * 1.8);
  }
}
