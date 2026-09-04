import { describe, expect, it } from "vitest";
import { BUILTIN_EFFECTS, clockControlledRecipe, effectAnimationState, effectById, effectiveEffectFontSize, recommendedEffectFontSize, retrieveEffects, type EffectRecipe } from "@/domain/effects";

describe("effect font sizing", () => {
  it("uses a readable display size for short impact text and tapers long copy", () => {
    const impact = effectById("data-impact").recipe;
    expect(recommendedEffectFontSize(impact, "42%")).toBe(96);
    expect(recommendedEffectFontSize(impact, "这是一个较长的冲击文字内容")).toBeLessThan(96);
    expect(recommendedEffectFontSize(effectById("warning-panel").recipe, "注意风险")).toBeLessThan(96);
  });

  it("repairs legacy number defaults without overriding deliberate custom sizes", () => {
    const impact = effectById("data-impact").recipe;
    expect(effectiveEffectFontSize(56, impact, "42%")).toBe(96);
    expect(effectiveEffectFontSize(40, impact, "42%")).toBe(40);
    expect(effectiveEffectFontSize(56, effectById("warning-panel").recipe, "注意风险")).toBe(56);
  });
});

describe("retrieveEffects", () => {
  it("ranks matching local effect metadata without a model call", () => {
    expect(retrieveEffects("展示季度增长 85% 和核心数据", 2).every((effect) => effect.tags.includes("数据"))).toBe(true);
    expect(retrieveEffects("总结一句重要金句", 1)[0].tags).toContain("金句");
  });

  it("maps semantic video intents even when the query does not repeat effect names", () => {
    expect(retrieveEffects("做一个简洁的开篇引入", 1)[0].tags).toContain("开场");
    expect(retrieveEffects("把操作方法按流程讲清楚", 1)[0].tags).toContain("流程");
    expect(retrieveEffects("展示销售额上涨与占比", 1)[0].tags).toContain("数据");
    expect(retrieveEffects("解释为什么会产生这个结果", 1)[0].id).toBe("knowledge-causal-chain");
    expect(retrieveEffects("纠正常见误区并给出真相", 1)[0].id).toBe("knowledge-myth-fact");
  });

  it("ships a production-sized uniquely addressable library with animated families and scenes", () => {
    expect(BUILTIN_EFFECTS).toHaveLength(81);
    expect(new Set(BUILTIN_EFFECTS.map((effect) => effect.id)).size).toBe(BUILTIN_EFFECTS.length);
    expect(BUILTIN_EFFECTS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "intro-highlight" }),
      expect.objectContaining({ id: "warning-panel" }),
      expect.objectContaining({ id: "knowledge-concept-map" }),
      expect.objectContaining({ id: "knowledge-causal-chain" }),
      expect.objectContaining({ id: "knowledge-argument-board" }),
      expect.objectContaining({ id: "knowledge-myth-fact" }),
      expect.objectContaining({ id: "knowledge-quote-lines" }),
      expect.objectContaining({ id: "scene-focus-stack", kind: "scene" })
    ]));
    const backgroundScenes = BUILTIN_EFFECTS.filter((effect) => effect.recipe.sceneBackground);
    const composedScenes = BUILTIN_EFFECTS.filter((effect) => effect.kind === "scene");
    expect(backgroundScenes).toHaveLength(8);
    expect(composedScenes).toHaveLength(6);
    expect(composedScenes.every((effect) => effect.sceneLayers && effect.sceneLayers.length >= 2)).toBe(true);
    expect(BUILTIN_EFFECTS.filter((effect) => effect.recipe.animation)).toHaveLength(53);
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

  it("converts legacy entrances into deterministic playhead states", () => {
    const recipe: EffectRecipe = { layout: "panel", entrance: "slide-left", paddingX: 10, paddingY: 10, borderWidth: 1, borderRadius: 2, backgroundOpacity: 0.5 };
    expect(clockControlledRecipe(recipe).entrance).toBe("none");
    expect(effectAnimationState(recipe, 0, 1).translateX).toBe(-15);
    expect(effectAnimationState(recipe, 450_000, 1)).toMatchObject({ translateX: 0, scale: 1 });
    expect(effectAnimationState(recipe, 225_000, 1)).toEqual(effectAnimationState(recipe, 225_000, 1));
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
