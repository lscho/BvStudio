export type OverlayStudioCurve = "hud" | "reflow" | "reel" | "pin" | "ease" | "exponential";

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
