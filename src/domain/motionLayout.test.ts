import { describe, expect, it } from "vitest";
import { effectById } from "@/domain/effects";
import {
  estimateMotionLayoutRect,
  motionLayoutRectsOverlap,
  resolveMotionLayout,
  type MotionLayoutLayer
} from "@/domain/motionLayout";

const canvas = { width: 1920, height: 1080 };

function layer(id: string, patch: Partial<MotionLayoutLayer> = {}): MotionLayoutLayer {
  return {
    id,
    startUs: 0,
    durationUs: 4_000_000,
    desiredX: 50,
    desiredY: 50,
    scale: 1,
    fontSize: 56,
    text: "市场格局",
    recipe: effectById("test-title-slide").recipe,
    priority: "primary",
    ...patch
  };
}

describe("resolveMotionLayout", () => {
  it("moves simultaneous layers apart while preserving a free requested position", () => {
    const layers = [layer("title"), layer("public", { text: "公共充电桩" })];
    const placements = resolveMotionLayout({ canvas, layers });
    const title = placements.get("title");
    const publicData = placements.get("public");

    expect(title).toMatchObject({ x: 50, y: 50, scale: 1 });
    expect(publicData).not.toBeNull();
    expect(motionLayoutRectsOverlap(
      estimateMotionLayoutRect(layers[0], title!, canvas),
      estimateMotionLayoutRect(layers[1], publicData!, canvas)
    )).toBe(false);
  });

  it("uses reference component footprints to keep simultaneous cards apart", () => {
    const layers = [
      layer("term", { effectId: "term-card", recipe: effectById("term-card").recipe, fontSize: 48 }),
      layer("pin", { effectId: "pin-board", recipe: effectById("pin-board").recipe, fontSize: 48 })
    ];
    const placements = resolveMotionLayout({ canvas, layers });
    const term = placements.get("term");
    const pin = placements.get("pin");

    expect(term).not.toBeNull();
    expect(pin).not.toBeNull();
    expect(motionLayoutRectsOverlap(
      estimateMotionLayoutRect(layers[0], term!, canvas),
      estimateMotionLayoutRect(layers[1], pin!, canvas)
    )).toBe(false);
    expect(term?.scale).toBeGreaterThanOrEqual(0.85);
    expect(pin?.scale).toBeGreaterThanOrEqual(0.85);
  });

  it("allows the same position when layer time ranges do not overlap", () => {
    const placements = resolveMotionLayout({
      canvas,
      layers: [
        layer("first", { durationUs: 2_000_000, desiredX: 34, desiredY: 32 }),
        layer("later", { startUs: 2_000_000, durationUs: 2_000_000, desiredX: 34, desiredY: 32 })
      ]
    });

    expect(placements.get("first")).toMatchObject({ x: 34, y: 32 });
    expect(placements.get("later")).toMatchObject({ x: 34, y: 32 });
  });

  it("keeps effects outside a timed subtitle safe area", () => {
    const motion = layer("motion", { desiredY: 88 });
    const placements = resolveMotionLayout({
      canvas,
      layers: [motion],
      safeAreas: [{ startUs: 0, durationUs: 4_000_000, rect: { left: 0, top: 78, right: 100, bottom: 100 } }]
    });
    const placement = placements.get("motion");

    expect(placement).not.toBeNull();
    expect(estimateMotionLayoutRect(motion, placement!, canvas).bottom).toBeLessThanOrEqual(78);
  });

  it("moves a component outside the configured presenter area", () => {
    const motion = layer("metric", { effectId: "ring-metric", recipe: effectById("ring-metric").recipe, fontSize: 48 });
    const safeArea = { left: 34, top: 6, right: 66, bottom: 78 };
    const placement = resolveMotionLayout({
      canvas,
      layers: [motion],
      safeAreas: [{ startUs: 0, durationUs: 4_000_000, rect: safeArea }]
    }).get("metric");

    expect(placement).not.toBeNull();
    expect(motionLayoutRectsOverlap(estimateMotionLayoutRect(motion, placement!, canvas), safeArea)).toBe(false);
  });

  it("uses a smaller fallback scale instead of dropping a wide component around a center presenter", () => {
    const motion = layer("wide", { effectId: "type-shift", recipe: effectById("type-shift").recipe, fontSize: 48 });
    const safeArea = { left: 34, top: 6, right: 66, bottom: 78 };
    const placement = resolveMotionLayout({
      canvas,
      layers: [motion],
      safeAreas: [
        { startUs: 0, durationUs: 4_000_000, rect: safeArea },
        { startUs: 0, durationUs: 4_000_000, rect: { left: 0, top: 78, right: 100, bottom: 100 } }
      ]
    }).get("wide");

    expect(placement).not.toBeNull();
    expect(placement?.scale).toBeLessThan(0.85);
    expect(motionLayoutRectsOverlap(estimateMotionLayoutRect(motion, placement!, canvas), safeArea)).toBe(false);
  });

  it.each([
    ["16:9", { width: 1920, height: 1080 }],
    ["9:16", { width: 1080, height: 1920 }],
    ["1:1", { width: 1080, height: 1080 }]
  ])("keeps a %s layout inside canvas and subtitle bounds", (_name, testedCanvas) => {
    const motion = layer("responsive", { desiredX: 95, desiredY: 95 });
    const placement = resolveMotionLayout({
      canvas: testedCanvas,
      layers: [motion],
      safeAreas: [{ startUs: 0, durationUs: 4_000_000, rect: { left: 0, top: 78, right: 100, bottom: 100 } }]
    }).get("responsive");
    expect(placement).not.toBeNull();
    if (!placement) return;
    const rect = estimateMotionLayoutRect(motion, placement, testedCanvas);
    expect(rect.left).toBeGreaterThanOrEqual(3);
    expect(rect.right).toBeLessThanOrEqual(97);
    expect(rect.top).toBeGreaterThanOrEqual(3);
    expect(rect.bottom).toBeLessThanOrEqual(78);
  });

  it("keeps primary layers and omits an unplaceable secondary layer", () => {
    const portrait = { width: 576, height: 1280 };
    const chartRecipe = effectById("test-bar-chart").recipe;
    const layers = [
      layer("primary-one", { recipe: chartRecipe, fontSize: 48, desiredY: 44, priority: "primary" }),
      layer("primary-two", { recipe: chartRecipe, fontSize: 48, desiredY: 67.5, priority: "primary" }),
      layer("secondary", { recipe: chartRecipe, fontSize: 48, priority: "secondary" })
    ];
    const placements = resolveMotionLayout({
      canvas: portrait,
      layers,
      safeAreas: [
        { startUs: 0, durationUs: 4_000_000, rect: { left: 0, top: 0, right: 100, bottom: 30 } },
        { startUs: 0, durationUs: 4_000_000, rect: { left: 0, top: 78, right: 100, bottom: 100 } }
      ]
    });

    expect(placements.get("primary-one")).not.toBeNull();
    expect(placements.get("primary-two")).not.toBeNull();
    expect(placements.get("primary-two")?.scale).toBeGreaterThanOrEqual(0.8);
    expect(placements.get("secondary")).toBeNull();
  });
});
