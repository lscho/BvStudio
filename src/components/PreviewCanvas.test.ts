import { describe, expect, it } from "vitest";
import { moveEffectTransform, resizeEffectTransform, videoTargetPoint } from "@/components/PreviewCanvas";

const transform = { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };

describe("PreviewCanvas effect manipulation", () => {
  it("moves an effect in canvas-relative percentages", () => {
    expect(moveEffectTransform(transform, 100, -50, 1000, 500)).toMatchObject({ x: 60, y: 40, scale: 1 });
  });

  it("resizes from every edge and clamps the supported scale", () => {
    expect(resizeEffectTransform(transform, "e", 100, 0, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "nw", -100, -50, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "se", 10_000, 10_000, 1000, 500).scale).toBe(3);
    expect(resizeEffectTransform(transform, "se", -10_000, -10_000, 1000, 500).scale).toBe(0.3);
  });

  it("maps draggable crop and focus targets to bounded canvas percentages", () => {
    const bounds = { left: 100, top: 50, width: 400, height: 200 };
    expect(videoTargetPoint(300, 100, bounds)).toEqual({ x: 50, y: 25 });
    expect(videoTargetPoint(50, 400, bounds)).toEqual({ x: 0, y: 100 });
  });
});
