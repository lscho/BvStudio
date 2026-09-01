export const OUTPUT_FPS_OPTIONS = [30, 60] as const;

export function normalizeOutputFps(fps: number) {
  if (!Number.isFinite(fps)) return OUTPUT_FPS_OPTIONS[0];
  return fps < 45 ? OUTPUT_FPS_OPTIONS[0] : OUTPUT_FPS_OPTIONS[1];
}
