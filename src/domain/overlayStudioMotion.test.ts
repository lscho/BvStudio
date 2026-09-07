import { describe, expect, it } from "vitest";
import { overlayStudioProgress, type OverlayStudioCurve } from "@/domain/overlayStudioMotion";

describe("Overlay Studio timing", () => {
  const curves: OverlayStudioCurve[] = ["hud", "reflow", "reel", "pin", "ease", "exponential"];

  it.each(curves)("keeps delayed starts and exact endpoints for %s", (curve) => {
    expect(overlayStudioProgress(0, 100_000, 500_000, curve)).toBe(0);
    expect(overlayStudioProgress(100_000, 100_000, 500_000, curve)).toBe(0);
    expect(overlayStudioProgress(600_000, 100_000, 500_000, curve)).toBe(1);
    expect(overlayStudioProgress(900_000, 100_000, 500_000, curve)).toBe(1);
  });

  it("uses the reference exponential count, not a normalized approximation", () => {
    expect(overlayStudioProgress(700_000, 0, 1_400_000, "exponential")).toBe(0.96875);
  });

  it("keeps pin overshoot without applying it to opacity", () => {
    expect(overlayStudioProgress(250_000, 0, 430_000, "pin")).toBeGreaterThan(1);
    expect(overlayStudioProgress(250_000, 0, 340_000)).toBeLessThan(1);
  });

  it("returns the same frame after jumping forwards and backwards", () => {
    const first = overlayStudioProgress(320_000);
    overlayStudioProgress(2_000_000);
    overlayStudioProgress(0);
    expect(overlayStudioProgress(320_000)).toBe(first);
    expect(first).toBeGreaterThan(0.9);
  });
});
