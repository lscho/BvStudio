import { describe, expect, it } from "vitest";
import { backgroundDotVisual } from "@/compositions/canvasRenderer";

describe("background dot animation", () => {
  it("uses wall-clock time so long subtitle scenes still visibly pulse", () => {
    const first = backgroundDotVisual(0, 0.25, 0.4, 0.35);
    const later = backgroundDotVisual(500_000, 0.25, 0.4, 0.35);

    expect(later).not.toEqual(first);
    for (const sample of [first, later]) {
      expect(sample.radiusScale).toBeGreaterThanOrEqual(0.55);
      expect(sample.radiusScale).toBeLessThanOrEqual(1.2);
      expect(sample.opacity).toBeGreaterThanOrEqual(0.4);
      expect(sample.opacity).toBeLessThanOrEqual(1);
    }
  });
});
