import { describe, expect, it } from "vitest";
import { BUILTIN_EFFECTS, effectAnimationState, retrieveEffects, type EffectRecipe } from "@/domain/effects";

describe("retrieveEffects", () => {
  it("ranks matching local effect metadata without a model call", () => {
    expect(retrieveEffects("展示季度增长 85% 和核心数据", 2).every((effect) => effect.tags.includes("数据"))).toBe(true);
    expect(retrieveEffects("总结一句重要金句", 1)[0].tags).toContain("金句");
  });

  it("maps semantic video intents even when the query does not repeat effect names", () => {
    expect(retrieveEffects("做一个简洁的开篇引入", 1)[0].tags).toContain("开场");
    expect(retrieveEffects("把操作方法按流程讲清楚", 1)[0].tags).toContain("流程");
    expect(retrieveEffects("展示销售额上涨与占比", 1)[0].tags).toContain("数据");
  });

  it("ships a compact uniquely addressable test library with full-canvas background scenes", () => {
    expect(BUILTIN_EFFECTS).toHaveLength(20);
    expect(new Set(BUILTIN_EFFECTS.map((effect) => effect.id)).size).toBe(BUILTIN_EFFECTS.length);
    expect(BUILTIN_EFFECTS.every((effect) => effect.id.startsWith("test-") || effect.id.startsWith("scene-"))).toBe(true);
    expect(BUILTIN_EFFECTS.filter((effect) => effect.category === "场景").every((effect) => Boolean(effect.recipe.sceneBackground))).toBe(true);
    expect(BUILTIN_EFFECTS.filter((effect) => effect.recipe.animation?.keyframes.some((frame) => frame.rotateX || frame.rotateY))).toHaveLength(3);
    expect(retrieveEffects("警示风险和常见误区", 1)[0].tags).toContain("风险");
  });

  it("interpolates declarative package keyframes with easing", () => {
    const recipe: EffectRecipe = {
      layout: "panel", entrance: "none", paddingX: 10, paddingY: 10, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0,
      animation: {
        durationSeconds: 1,
        easing: "linear",
        keyframes: [
          { offset: 0, translateX: -100, translateY: 20, scale: 0.5, rotation: -10 },
          { offset: 1, translateX: 0, translateY: 0, scale: 1, rotation: 0 }
        ]
      }
    };
    expect(effectAnimationState(recipe, 500_000, 1)).toEqual({ translateX: -50, translateY: 10, scale: 0.75, rotation: -5, rotateX: 0, rotateY: 0, perspective: 0 });
    expect(effectAnimationState(recipe, 1_000_000, 2)).toEqual({ translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateX: 0, rotateY: 0, perspective: 0 });
  });

  it("applies per-keyframe easing and interpolates pseudo-3D channels", () => {
    const recipe: EffectRecipe = {
      layout: "frame", entrance: "none", paddingX: 10, paddingY: 10, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0,
      animation: {
        durationSeconds: 1,
        easing: "linear",
        keyframes: [
          { offset: 0, translateX: 0, translateY: 0, scale: 1, rotation: 0, rotateY: -60, perspective: 800 },
          // eased segment: cubic-out reaches ~87.5% at its midpoint
          { offset: 1, translateX: 100, translateY: 0, scale: 2, rotation: 40, easing: "cubic-out", rotateY: 0, perspective: 1600 }
        ]
      }
    };
    const middle = effectAnimationState(recipe, 500_000, 1);
    expect(middle.translateX).toBeCloseTo(87.5, 6);
    expect(middle.scale).toBeCloseTo(2 - Math.pow(0.5, 3), 6);
    expect(middle.rotateY).toBeCloseTo(-60 * (1 - 0.875), 6);
    expect(middle.perspective).toBeCloseTo(1600 - 800 * (1 - 0.875), 6);
  });
});
