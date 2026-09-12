import { describe, expect, it } from "vitest";
import {
  canUseEffect,
  CORE_FREE_EFFECT_IDS,
  EFFECT_CATEGORY_ORDER,
  effectTier,
  effectTierMap,
  FREE_EFFECTS_PER_CATEGORY,
  PREMIUM_EFFECT_CATEGORY
} from "@/domain/effectAccess";
import { BUILTIN_EFFECTS, PREMIUM_EFFECT_IDS, PROMOTED_EFFECT_CATEGORIES, type CompositionDefinition, type EffectCategory } from "@/domain/effects";

const tiers = effectTierMap(BUILTIN_EFFECTS);
const regularCategories = EFFECT_CATEGORY_ORDER.filter((category) => category !== PREMIUM_EFFECT_CATEGORY);

function effectsOf(category: EffectCategory) {
  return BUILTIN_EFFECTS.filter((effect) => effect.category === category);
}

describe("effectTierMap", () => {
  it("lists every builtin category in the display order", () => {
    const categories = new Set(BUILTIN_EFFECTS.map((effect) => effect.category));
    for (const category of categories) expect(EFFECT_CATEGORY_ORDER).toContain(category);
    expect(EFFECT_CATEGORY_ORDER.at(-1)).toBe(PREMIUM_EFFECT_CATEGORY);
    expect(new Set(EFFECT_CATEGORY_ORDER).size).toBe(EFFECT_CATEGORY_ORDER.length);
  });

  it("keeps the first ten effects of every regular category free and locks the rest", () => {
    for (const category of regularCategories) {
      const effects = effectsOf(category);
      expect(effects.length, `${category} 分类为空`).toBeGreaterThan(0);
      let quotaIndex = 0;
      effects.forEach((effect, index) => {
        const coreFree = CORE_FREE_EFFECT_IDS.includes(effect.id as (typeof CORE_FREE_EFFECT_IDS)[number]);
        const expected = coreFree || quotaIndex < FREE_EFFECTS_PER_CATEGORY ? "free" : "pro";
        expect(effectTier(effect, tiers), `${category} #${index + 1} ${effect.id}`).toBe(expected);
        if (!coreFree) quotaIndex += 1;
      });
    }
  });

  it("locks every effect in the premium category", () => {
    const premium = effectsOf(PREMIUM_EFFECT_CATEGORY);
    const libraryIds = new Set(BUILTIN_EFFECTS.map((effect) => effect.id));
    for (const id of PREMIUM_EFFECT_IDS) {
      expect(libraryIds.has(id), `高级清单里的 ${id} 不存在`).toBe(true);
      const effect = BUILTIN_EFFECTS.find((candidate) => candidate.id === id)!;
      expect(effect.category, `${id} 不在高级分类`).toBe(PREMIUM_EFFECT_CATEGORY);
      expect(effectTier(effect, tiers)).toBe("pro");
    }
    expect(premium.length).toBeGreaterThanOrEqual(PREMIUM_EFFECT_IDS.length);
    for (const effect of premium) expect(effectTier(effect, tiers)).toBe("pro");
  });

  it("keeps promoted categories down to the free quota", () => {
    for (const category of PROMOTED_EFFECT_CATEGORIES) {
      const effects = effectsOf(category);
      const coreFreeCount = effects.filter((effect) => CORE_FREE_EFFECT_IDS.includes(effect.id as (typeof CORE_FREE_EFFECT_IDS)[number])).length;
      expect(effects).toHaveLength(FREE_EFFECTS_PER_CATEGORY + coreFreeCount);
      for (const effect of effects) expect(effectTier(effect, tiers), effect.id).toBe("free");
    }
  });

  it("keeps image-only generation available without Pro", () => {
    const effect = BUILTIN_EFFECTS.find((candidate) => candidate.id === "still-image-motion")!;
    expect(effect.category).toBe("展示");
    expect(effectTier(effect, tiers)).toBe("free");
  });

  it("ships a mix of free and locked effects so the limit is observable", () => {
    const values = [...tiers.values()];
    expect(values.filter((tier) => tier === "free").length).toBeGreaterThan(0);
    expect(values.filter((tier) => tier === "pro").length).toBeGreaterThan(0);
    expect(tiers.size).toBe(BUILTIN_EFFECTS.length);
  });

  it("treats effects outside the builtin library as free unless they sit in the premium category", () => {
    const extension: CompositionDefinition = { ...BUILTIN_EFFECTS[0], id: "extension-card", category: "卡片" };
    const premiumExtension: CompositionDefinition = { ...BUILTIN_EFFECTS[0], id: "extension-premium", category: PREMIUM_EFFECT_CATEGORY };
    expect(effectTier(extension, tiers)).toBe("free");
    expect(effectTier(premiumExtension, tiers)).toBe("pro");
  });

  it("keeps builtin tiers stable when an installed package appends more effects", () => {
    const extension: CompositionDefinition = { ...BUILTIN_EFFECTS[0], id: "extension-card", category: "卡片" };
    const withExtension = effectTierMap([...BUILTIN_EFFECTS, extension]);
    for (const effect of BUILTIN_EFFECTS) {
      expect(withExtension.get(effect.id), effect.id).toBe(tiers.get(effect.id));
    }
  });

  it("only lets Pro users open locked effects", () => {
    expect(canUseEffect("free", false)).toBe(true);
    expect(canUseEffect("free", true)).toBe(true);
    expect(canUseEffect("pro", false)).toBe(false);
    expect(canUseEffect("pro", true)).toBe(true);
  });
});
