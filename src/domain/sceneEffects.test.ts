import { describe, expect, it } from "vitest";
import { allEffects, effectById } from "@/domain/effects";
import { createGeneratedEffectLayers, effectIdsForSubtitle, suggestedEffectTransform } from "@/domain/sceneEffects";

describe("scene effect matching", () => {
  it("returns stable ids from the active migrated effect library", () => {
    const first = effectIdsForSubtitle("开场介绍：今天讲三个核心步骤", 4);
    const second = effectIdsForSubtitle("开场介绍：今天讲三个核心步骤", 4);

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first.every((id) => allEffects().some((effect) => effect.id === id))).toBe(true);
    expect(first.every((id) => effectById(id).kind !== "scene")).toBe(true);
  });

  it("expands scene selections into atomic editable layers with matching metadata", () => {
    const layers = createGeneratedEffectLayers(["scene-step-guide", "quote-card"], "三步完成配置", "#5fa8ff", 5_000_000, "subtitle-match", "第一步先配置模型");

    expect(layers).toHaveLength(4);
    expect(layers.every((layer) => effectById(layer.effectId).kind !== "scene")).toBe(true);
    expect(layers.every((layer) => layer.matchQuery === "第一步先配置模型")).toBe(true);
    expect(layers.every((layer) => layer.startOffsetUs + layer.durationUs <= 5_000_000)).toBe(true);
  });

  it("places ordinary AI-selected effects in semantic canvas regions", () => {
    const layers = createGeneratedEffectLayers(["title-highlight", "number-pop", "bullet-reveal", "underline-sweep"], "增长 42%", "#47d7ac", 4_000_000, "ai");
    expect(layers.map((layer) => [layer.transform.x, layer.transform.y])).toEqual([[50, 22], [76, 30], [28, 56], [50, 78]]);
    expect(new Set(layers.map((layer) => `${layer.transform.x}:${layer.transform.y}`)).size).toBe(4);
    expect(suggestedEffectTransform(effectById("data-bar-chart"), 0).scale).toBeLessThanOrEqual(0.7);
  });
});
