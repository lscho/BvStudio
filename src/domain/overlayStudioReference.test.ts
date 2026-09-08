import { describe, expect, it } from "vitest";
import { referenceStageInteractionPatch } from "@/domain/overlayStudioReference";

describe("reference stage interaction", () => {
  it("converts canvas movement and resizing into authored card parameters", () => {
    expect(referenceStageInteractionPatch(
      { offsetX: 100, offsetY: -20, scale: 2 },
      { x: 60, y: 40, scale: 1.5, rotation: 25, opacity: 0.7 },
      { width: 1920, height: 1080 }
    )).toEqual({
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 0.7 },
      transformKeyframes: [],
      params: { offsetX: 292, offsetY: -128, scale: 3 }
    });
  });

  it("keeps the authored card scale inside the reference limits", () => {
    expect(referenceStageInteractionPatch(
      { scale: 0.4 },
      { x: 50, y: 50, scale: 0.5, rotation: 0, opacity: 1 },
      { width: 1080, height: 1920 }
    ).params.scale).toBe(0.3);
  });
});
