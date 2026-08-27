import { describe, expect, it } from "vitest";
import { allEffects, effectById } from "@/domain/effects";
import { createGeneratedEffectLayers, effectIdsForSubtitle } from "@/domain/sceneEffects";

describe("scene effect matching", () => {
  it("returns stable installed effect or scene ids for timed subtitle text", () => {
    const first = effectIdsForSubtitle("开场介绍：今天讲三个核心步骤", 4);
    const second = effectIdsForSubtitle("开场介绍：今天讲三个核心步骤", 4);

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first.every((id) => allEffects().some((effect) => effect.id === id))).toBe(true);
    expect(first.some((id) => effectById(id).kind === "scene")).toBe(true);
  });

  it("expands scene selections into atomic editable layers with matching metadata", () => {
    const layers = createGeneratedEffectLayers(["scene-step-guide", "quote-card"], "三步完成配置", "#5fa8ff", 5_000_000, "subtitle-match", "第一步先配置模型");

    expect(layers).toHaveLength(4);
    expect(layers.every((layer) => effectById(layer.effectId).kind !== "scene")).toBe(true);
    expect(layers.every((layer) => layer.matchQuery === "第一步先配置模型")).toBe(true);
    expect(layers.every((layer) => layer.startOffsetUs + layer.durationUs <= 5_000_000)).toBe(true);
  });
});
