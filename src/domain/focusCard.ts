import type { CompositionParams } from "@/domain/effects";
import type { TransformProps, VideoShape } from "@/domain/project";

export interface FocusCardRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

function numberParam(params: CompositionParams | undefined, key: string, fallback: number) {
  const value = params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function focusCardTargetRect(params: CompositionParams | undefined, canvasWidth: number, canvasHeight: number): FocusCardRect {
  const sx = canvasWidth / 1920;
  const sy = canvasHeight / 1080;
  const portrait = canvasWidth / canvasHeight < 0.8;
  const unit = portrait ? Math.min(canvasWidth / (700 / 0.8), canvasHeight / (700 / 0.45)) : Math.min(sx, sy);
  const width = numberParam(params, "camW", 700) * unit;
  const height = numberParam(params, "camH", 700) * unit;
  const side = params?.side === "right" ? "right" : "left";
  const baseX = portrait ? (canvasWidth - width) / 2 : side === "right" ? canvasWidth - 110 * unit - width : 110 * unit;
  return {
    x: baseX + numberParam(params, "camDX", 0) * unit,
    y: (portrait ? canvasHeight * 0.08 : 190 * unit) + numberParam(params, "camDY", 0) * unit,
    width,
    height,
    radius: 36 * unit
  };
}

export function focusCardMoveProgress(params: CompositionParams | undefined, timeUs: number) {
  const durationUs = Math.max(100_000, numberParam(params, "moveMs", 720) * 1_000);
  const progress = clamp01(timeUs / durationUs);
  return 1 - (1 - progress) ** 4;
}

export function focusCardSourceRect(transform: TransformProps, shape: VideoShape, maskRadius: number, canvasWidth: number, canvasHeight: number, frame?: { width: number; height: number }): FocusCardRect {
  const square = shape === "circle" || shape === "square";
  const baseWidth = frame?.width ?? (square ? Math.min(canvasWidth, canvasHeight) : canvasWidth);
  const baseHeight = frame?.height ?? (square ? Math.min(canvasWidth, canvasHeight) : canvasHeight);
  const width = baseWidth * transform.scale;
  const height = baseHeight * transform.scale;
  const radius = shape === "circle"
    ? Math.min(width, height) / 2
    : shape === "rounded" ? Math.min(width, height) * Math.max(0, Math.min(50, maskRadius)) / 100 : 0;
  return {
    x: canvasWidth * transform.x / 100 - width / 2,
    y: canvasHeight * transform.y / 100 - height / 2,
    width,
    height,
    radius
  };
}

export function focusCardMediaRect(params: CompositionParams | undefined, canvasWidth: number, canvasHeight: number, timeUs: number, source: FocusCardRect = { x: 0, y: 0, width: canvasWidth, height: canvasHeight, radius: 0 }): FocusCardRect {
  const target = focusCardTargetRect(params, canvasWidth, canvasHeight);
  const progress = focusCardMoveProgress(params, timeUs);
  return {
    x: source.x + (target.x - source.x) * progress,
    y: source.y + (target.y - source.y) * progress,
    width: source.width + (target.width - source.width) * progress,
    height: source.height + (target.height - source.height) * progress,
    radius: source.radius + (target.radius - source.radius) * progress
  };
}
