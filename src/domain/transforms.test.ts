import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSFORM, videoLayoutForPreset, visualTransformAt } from "@/domain/transforms";

describe("visual transforms", () => {
  it("interpolates position and scale between keyframes", () => {
    const transform = visualTransformAt(DEFAULT_TRANSFORM, [
      { offsetUs: 0, x: 50, y: 50, scale: 1, easing: "linear" },
      { offsetUs: 1_000_000, x: 82, y: 20, scale: 0.3, easing: "linear" }
    ], 500_000);
    expect(transform).toMatchObject({ x: 66, y: 35, scale: 0.65, rotation: 0, opacity: 1 });
  });

  it("creates a full-screen to corner handoff preset", () => {
    const layout = videoLayoutForPreset("shrink-top-right", 4_000_000);
    expect(layout.zIndex).toBe(10);
    expect(layout.transformKeyframes).toEqual([
      expect.objectContaining({ offsetUs: 0, x: 50, y: 50, scale: 1 }),
      expect.objectContaining({ offsetUs: 1_120_000, x: 82, y: 20, scale: 0.3 })
    ]);
  });
});
