import { describe, expect, it } from "vitest";
import { moveEffectTransform, resizeEffectTransform } from "@/components/PreviewCanvas";

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
});
