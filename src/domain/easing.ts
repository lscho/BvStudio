import {
  easeBackIn,
  easeBackInOut,
  easeBackOut,
  easeBounceOut,
  easeCircleOut,
  easeCubicIn,
  easeCubicInOut,
  easeCubicOut,
  easeElasticOut,
  easeLinear,
  easeQuadIn,
  easeQuadInOut,
  easeQuadOut
} from "d3-ease";

/**
 * Single source of truth for every easing name used by effect keyframes,
 * visual transform keyframes, and camera motion. The four legacy names keep
 * their historical quadratic math so existing projects and packages replay
 * identically; the extended names ride the .bveffect schemaVersion 4 contract.
 */
export const EASING_NAMES = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-in",
  "cubic-out",
  "cubic-in-out",
  "quart-out",
  "back-in",
  "back-out",
  "back-in-out",
  "circ-out",
  "elastic-out",
  "bounce-out"
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

/** Legacy subset understood by every schema version (packages and projects). */
export const LEGACY_EASING_NAMES: readonly EasingName[] = ["linear", "ease-in", "ease-out", "ease-in-out"];

const CURVES: Record<EasingName, (progress: number) => number> = {
  linear: easeLinear,
  "ease-in": easeQuadIn,
  "ease-out": easeQuadOut,
  "ease-in-out": easeQuadInOut,
  "cubic-in": easeCubicIn,
  "cubic-out": easeCubicOut,
  "cubic-in-out": easeCubicInOut,
  // d3 ships polynomials as a parameterized family; a bare quart-out is this one-liner.
  "quart-out": (progress) => 1 - (1 - progress) ** 4,
  "back-in": easeBackIn,
  "back-out": easeBackOut,
  "back-in-out": easeBackInOut,
  "circ-out": easeCircleOut,
  "elastic-out": easeElasticOut,
  "bounce-out": easeBounceOut
};

export const EASING_LABELS: Record<EasingName, string> = {
  linear: "匀速",
  "ease-in": "渐快",
  "ease-out": "渐慢",
  "ease-in-out": "平滑",
  "cubic-in": "急进",
  "cubic-out": "缓出",
  "cubic-in-out": "急缓",
  "quart-out": "骤停",
  "back-in": "回撤入",
  "back-out": "回弹出",
  "back-in-out": "回弹往复",
  "circ-out": "弧线收尾",
  "elastic-out": "弹簧",
  "bounce-out": "落地弹跳"
};

export function isEasingName(value: string): value is EasingName {
  return Object.prototype.hasOwnProperty.call(CURVES, value);
}

/** Evaluates a named easing curve; callers own range clamping of progress. */
export function eased(progress: number, easing: EasingName): number {
  return (CURVES[easing] ?? easeLinear)(progress);
}
