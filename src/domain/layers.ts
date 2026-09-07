export const DEFAULT_VIDEO_LAYER = 20;
export const DEFAULT_EFFECT_LAYER = 220;
export const DEFAULT_BACKGROUND_LAYER = 0;

export function normalizeLayer(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.round(value))) : fallback;
}
