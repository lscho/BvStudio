import { measureChartBox } from "@/domain/chartEffects";
import type { EffectRecipe } from "@/domain/effects";

export interface MotionLayoutCanvas {
  width: number;
  height: number;
}

export interface MotionLayoutRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MotionLayoutLayer {
  id: string;
  startUs: number;
  durationUs: number;
  desiredX: number;
  desiredY: number;
  scale: number;
  fontSize: number;
  text: string;
  recipe: EffectRecipe;
  priority: "primary" | "secondary";
}

export interface MotionLayoutPlacement {
  x: number;
  y: number;
  scale: number;
}

export interface MotionLayoutSafeArea {
  startUs: number;
  durationUs: number;
  rect: MotionLayoutRect;
}

export interface OccupiedMotionLayoutLayer {
  layer: MotionLayoutLayer;
  placement: MotionLayoutPlacement;
}

interface ResolveMotionLayoutInput {
  canvas: MotionLayoutCanvas;
  layers: readonly MotionLayoutLayer[];
  safeAreas?: readonly MotionLayoutSafeArea[];
  occupiedLayers?: readonly OccupiedMotionLayoutLayer[];
}

interface TimedPlacement {
  layer: MotionLayoutLayer;
  rect: MotionLayoutRect;
}

const canvasMarginPercent = 3;
const collisionGapPercent = 1.25;
const minimumTextScale = 0.65;
const minimumChartScale = 0.8;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function intervalsOverlap(left: { startUs: number; durationUs: number }, right: { startUs: number; durationUs: number }) {
  return left.startUs < right.startUs + right.durationUs && right.startUs < left.startUs + left.durationUs;
}

function characterWidthUnits(character: string) {
  if (/\s/u.test(character)) return 0.35;
  return /^[\u0000-\u00ff]$/u.test(character) ? 0.62 : 1;
}

function measuredTextBox(text: string, fontSize: number, maximumWidth: number) {
  let maximumLineWidth = 0;
  let lineWidth = 0;
  let lineCount = 1;
  for (const character of Array.from(text.trim() || " ")) {
    if (character === "\n") {
      maximumLineWidth = Math.max(maximumLineWidth, lineWidth);
      lineWidth = 0;
      lineCount += 1;
      continue;
    }
    const characterWidth = characterWidthUnits(character) * fontSize;
    if (lineWidth > 0 && lineWidth + characterWidth > maximumWidth) {
      maximumLineWidth = Math.max(maximumLineWidth, lineWidth);
      lineWidth = characterWidth;
      lineCount += 1;
    } else {
      lineWidth += characterWidth;
    }
  }
  maximumLineWidth = Math.max(fontSize, maximumLineWidth, lineWidth);
  return { width: maximumLineWidth, height: lineCount * fontSize * 1.2 };
}

function layerPixelSize(layer: MotionLayoutLayer, canvas: MotionLayoutCanvas, scale: number) {
  const paddingX = layer.recipe.paddingX;
  const paddingY = layer.recipe.paddingY;
  const content = layer.recipe.chart
    ? measureChartBox(layer.recipe.chart, layer.fontSize)
    : measuredTextBox(layer.text, layer.fontSize, Math.max(40, canvas.width * 0.72 - paddingX * 2));
  const animationScale = Math.max(1, ...layer.recipe.animation?.keyframes.map((frame) => frame.scale) ?? [1]);
  const animationTranslateX = Math.max(0, ...layer.recipe.animation?.keyframes.map((frame) => Math.abs(frame.translateX)) ?? [0]) / 100;
  const animationTranslateY = Math.max(0, ...layer.recipe.animation?.keyframes.map((frame) => Math.abs(frame.translateY)) ?? [0]) / 100;
  const width = (content.width + paddingX * 2) * scale * animationScale;
  const height = (content.height + paddingY * 2) * scale * animationScale;
  return {
    width: width * (1 + animationTranslateX * 2),
    height: height * (1 + animationTranslateY * 2)
  };
}

export function estimateMotionLayoutRect(
  layer: MotionLayoutLayer,
  placement: MotionLayoutPlacement,
  canvas: MotionLayoutCanvas
): MotionLayoutRect {
  const size = layerPixelSize(layer, canvas, placement.scale);
  const halfWidth = size.width / Math.max(1, canvas.width) * 50;
  const halfHeight = size.height / Math.max(1, canvas.height) * 50;
  return {
    left: placement.x - halfWidth,
    top: placement.y - halfHeight,
    right: placement.x + halfWidth,
    bottom: placement.y + halfHeight
  };
}

export function motionLayoutRectsOverlap(left: MotionLayoutRect, right: MotionLayoutRect) {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function expandedRect(rect: MotionLayoutRect, amount: number): MotionLayoutRect {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount
  };
}

function candidatePositions(layer: MotionLayoutLayer, canvas: MotionLayoutCanvas) {
  const portrait = canvas.height > canvas.width;
  const square = Math.abs(canvas.width / Math.max(1, canvas.height) - 1) < 0.15;
  const xSlots = portrait ? [28, 50, 72] : square ? [24, 50, 76] : [22, 50, 78];
  const ySlots = portrait ? [14, 29, 44, 59, 72] : [18, 36, 54, 70];
  const slots = xSlots.flatMap((x) => ySlots.map((y) => ({ x, y })))
    .sort((left, right) => (
      (left.x - layer.desiredX) ** 2 + (left.y - layer.desiredY) ** 2
      - (right.x - layer.desiredX) ** 2 - (right.y - layer.desiredY) ** 2
    ));
  return [{ x: layer.desiredX, y: layer.desiredY }, ...slots];
}

function placementAt(layer: MotionLayoutLayer, canvas: MotionLayoutCanvas, scale: number, candidate: { x: number; y: number }) {
  const size = layerPixelSize(layer, canvas, scale);
  const halfWidth = size.width / Math.max(1, canvas.width) * 50;
  const halfHeight = size.height / Math.max(1, canvas.height) * 50;
  const minimumX = canvasMarginPercent + halfWidth;
  const maximumX = 100 - canvasMarginPercent - halfWidth;
  const minimumY = canvasMarginPercent + halfHeight;
  const maximumY = 100 - canvasMarginPercent - halfHeight;
  if (minimumX > maximumX || minimumY > maximumY) return null;
  return {
    x: clamp(candidate.x, minimumX, maximumX),
    y: clamp(candidate.y, minimumY, maximumY),
    scale
  };
}

function candidateScales(layer: MotionLayoutLayer) {
  const minimumScale = layer.recipe.chart ? minimumChartScale : minimumTextScale;
  return [...new Set([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
    .map((factor) => layer.scale * factor)
    .concat(minimumScale)
    .map((candidate) => Math.max(minimumScale, Math.min(2.5, candidate)).toFixed(4)))]
    .map(Number);
}

export function resolveMotionLayout({ canvas, layers, safeAreas = [], occupiedLayers = [] }: ResolveMotionLayoutInput) {
  const result = new Map<string, MotionLayoutPlacement | null>();
  const placed: TimedPlacement[] = occupiedLayers.map(({ layer, placement }) => ({
    layer,
    rect: estimateMotionLayoutRect(layer, placement, canvas)
  }));
  const ordered = layers.map((layer, index) => ({ layer, index })).sort((left, right) => {
    const priority = (left.layer.priority === "primary" ? 0 : 1) - (right.layer.priority === "primary" ? 0 : 1);
    return priority || left.layer.startUs - right.layer.startUs || left.index - right.index;
  });

  for (const { layer } of ordered) {
    let resolved: MotionLayoutPlacement | null = null;
    for (const scale of candidateScales(layer)) {
      for (const candidate of candidatePositions(layer, canvas)) {
        const placement = placementAt(layer, canvas, scale, candidate);
        if (!placement) continue;
        const rect = estimateMotionLayoutRect(layer, placement, canvas);
        const collisionRect = expandedRect(rect, collisionGapPercent / 2);
        const hitsLayer = placed.some((item) => intervalsOverlap(layer, item.layer)
          && motionLayoutRectsOverlap(collisionRect, expandedRect(item.rect, collisionGapPercent / 2)));
        const hitsSafeArea = safeAreas.some((area) => intervalsOverlap(layer, area)
          && motionLayoutRectsOverlap(collisionRect, area.rect));
        if (hitsLayer || hitsSafeArea) continue;
        resolved = placement;
        break;
      }
      if (resolved) break;
    }
    result.set(layer.id, resolved);
    if (resolved) placed.push({ layer, rect: estimateMotionLayoutRect(layer, resolved, canvas) });
  }

  return result;
}
