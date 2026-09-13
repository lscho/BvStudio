import type { CompositionParams } from "@/domain/effects";

export type OverlayStudioCurve = "hud" | "reflow" | "reel" | "pin" | "ease" | "exponential";

const autoTimedEffectIds = new Set([
  "pin-board",
  "step-timeline",
  "checklist",
  "info-board",
  "pain-points",
  "action-band",
  "flow-chart",
  "stepper-flow"
]);

const stepTimingSpecs: Readonly<Record<string, { field: string; leadMs: number; resultOffsetMs?: number }>> = {
  "pin-board": { field: "items", leadMs: 400 },
  "step-timeline": { field: "steps", leadMs: 0 },
  checklist: { field: "items", leadMs: 0 },
  "pain-points": { field: "pains", leadMs: 0, resultOffsetMs: 120 },
  "flow-chart": { field: "nodes", leadMs: 0 },
  "stepper-flow": { field: "steps", leadMs: 400 }
};

const controlPoints = {
  hud: [0.22, 1, 0.36, 1],
  reflow: [0.25, 0.9, 0.3, 1],
  reel: [0.2, 0.85, 0.25, 1],
  pin: [0.2, 0.9, 0.3, 1.3],
  ease: [0.25, 0.1, 0.25, 1]
} as const;

function coordinate(t: number, a: number, b: number) {
  return 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
}

// CSS timing functions map elapsed time through the curve's X axis first.
// Sampling Y directly changes the motion, and clamping Y removes the pin's overshoot.
export function overlayStudioProgress(timeUs: number, startUs = 0, durationUs = 640_000, curve: OverlayStudioCurve = "hud") {
  const progress = Math.max(0, Math.min(1, (timeUs - startUs) / Math.max(1, durationUs)));
  if (progress === 0 || progress === 1) return progress;
  if (curve === "exponential") return 1 - 2 ** (-10 * progress);
  const [x1, y1, x2, y2] = controlPoints[curve];
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) / 2;
    if (coordinate(middle, x1, x2) < progress) low = middle;
    else high = middle;
  }
  return coordinate((low + high) / 2, y1, y2);
}

export function supportsOverlayStudioAutoTiming(compositionId: string) {
  return autoTimedEffectIds.has(compositionId);
}

/** Per-item subtitle anchors in clip-local integer microseconds; absent in older projects. */
export function motionRevealTimesUs(params: CompositionParams | undefined): number[] {
  if (typeof params?.revealTimesUs !== "string" || !params.revealTimesUs.trim()) return [];
  const parts = params.revealTimesUs.split("|");
  if (parts.some((part) => !part.trim())) return [];
  const values = parts.map(Number);
  return values.length <= 80 && values.every((value, index) => Number.isSafeInteger(value) && value >= 0
    && (index === 0 || value >= values[index - 1])) ? values : [];
}

export function motionItemStartUs(params: CompositionParams | undefined, index: number, fallbackUs: number) {
  return motionRevealTimesUs(params)[index] ?? fallbackUs;
}

function sequenceLength(value: CompositionParams[string] | undefined) {
  return typeof value === "string"
    ? value.split(/[|｜]/u).map((part) => part.trim()).filter(Boolean).length
    : 0;
}

function roundedTiming(value: number) {
  return Math.round(value / 10) * 10;
}

function authoredTimeCount(compositionId: string, params: CompositionParams, fallback: number) {
  if (compositionId === "info-board" && typeof params.rows === "string") {
    return params.rows.split(/\r?\n/u).map((row) => row.trim()).filter(Boolean).length;
  }
  if (compositionId === "action-band") {
    const stages = [params.title, params.cards, params.band, params.bandCaption, params.foot];
    let lastVisibleStage = -1;
    stages.forEach((value, index) => {
      if (typeof value === "string" && value.trim()) lastVisibleStage = index;
    });
    return lastVisibleStage >= 0 ? lastVisibleStage + 1 : fallback;
  }
  return fallback;
}

/** Fits authored reveal beats into an AI-matched subtitle or scene range without mutating persisted controls. */
export function fitOverlayStudioTimingParams(
  compositionId: string,
  params: CompositionParams | undefined,
  durationUs: number
): CompositionParams | undefined {
  if (!params || !supportsOverlayStudioAutoTiming(compositionId) || !Number.isFinite(durationUs) || durationUs <= 0) return params;
  if (motionRevealTimesUs(params).length) return params;
  const durationMs = Math.max(100, durationUs / 1_000);
  const transitionTailMs = Math.min(durationMs >= 8_000 ? 1_600 : 600, Math.max(120, durationMs * 0.2));
  const lastRevealStartMs = Math.max(0, durationMs - transitionTailMs);
  let next = params;
  const replace = (key: string, value: CompositionParams[string]) => {
    if (next === params) next = { ...params };
    next[key] = value;
  };

  if (typeof params.times === "string") {
    const authoredTimes = params.times.split("|").map((value) => Number.parseFloat(value.trim()));
    const timeCount = Math.min(authoredTimes.length, authoredTimeCount(compositionId, params, authoredTimes.length));
    const activeTimes = authoredTimes.slice(0, timeCount);
    const authoredEnd = activeTimes.at(-1);
    if (activeTimes.length > 1 && activeTimes.every(Number.isFinite) && authoredEnd !== undefined && authoredEnd > 0) {
      const scale = lastRevealStartMs / 1_000 / authoredEnd;
      replace("times", activeTimes.map((value) => Number((value * scale).toFixed(3))).join("|"));
    }
  }

  const spec = stepTimingSpecs[compositionId];
  if (!spec) return next;
  const count = sequenceLength(params[spec.field]);
  if (!count) return next;
  const hasResult = compositionId === "pain-points" && typeof params.result === "string" && Boolean(params.result.trim());
  const intervals = hasResult ? count : Math.max(1, count - 1);
  const resultOffsetMs = hasResult ? spec.resultOffsetMs ?? 0 : 0;
  const availableMs = Math.max(80 * intervals, lastRevealStartMs - spec.leadMs - resultOffsetMs);
  replace("stepMs", Math.max(80, Math.min(15_000, roundedTiming(availableMs / intervals))));
  return next;
}
