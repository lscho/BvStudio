import { describe, expect, it } from "vitest";
import { fitOverlayStudioTimingParams, overlayStudioProgress, type OverlayStudioCurve } from "@/domain/overlayStudioMotion";

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

  it("spreads cumulative AI effect steps across the matched subtitle duration", () => {
    const params = fitOverlayStudioTimingParams("pain-points", {
      stepMs: 180,
      pains: "重复剪辑|素材难找|交付变慢",
      result: "制作成本持续上升"
    }, 3_000_000);

    expect(params).toMatchObject({ stepMs: expect.any(Number) });
    expect(Number(params?.stepMs)).toBeGreaterThan(600);
    expect(Number(params?.stepMs)).toBeLessThan(800);
  });

  it("fits authored stage timestamps to the end of the matched subtitle range", () => {
    const params = fitOverlayStudioTimingParams("action-band", {
      times: "0.3|2.2|4.8|7.4"
    }, 4_000_000);
    const times = String(params?.times).split("|").map(Number);

    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)).toBeGreaterThan(3);
    expect(times.at(-1)).toBeLessThan(4);
  });

  it("fits only the timestamps used by generated cumulative content", () => {
    const params = fitOverlayStudioTimingParams("info-board", {
      rows: "head|核心结论||\ncheck|效率提升\ncheck|成本降低\nseal|值得采用|",
      times: "0.3|2|3.6|5.2|6.8|8.4|10|11.6|13.2|14.8"
    }, 3_000_000);
    const times = String(params?.times).split("|").map(Number);

    expect(times).toHaveLength(4);
    expect(times.at(-1)).toBe(2.4);
  });
});
