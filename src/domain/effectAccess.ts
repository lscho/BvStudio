// 动效可用性规则：分类内前 N 个免费，其余需要 Pro；高级分类全部需要 Pro。
// 规则说明与高级清单见 docs/12-动效分类与Pro可用性约束.md。
import type { CompositionDefinition, EffectCategory } from "@/domain/effects";

/** 每个常规分类免费开放的动效数量；该分类第 11 个起需要 Pro。 */
export const FREE_EFFECTS_PER_CATEGORY = 10;

/** 生成基础能力依赖的核心动效始终免费，不占用分类免费额度。 */
export const CORE_FREE_EFFECT_IDS = ["still-image-motion"] as const;

const coreFreeEffectIdSet = new Set<string>(CORE_FREE_EFFECT_IDS);

/** 高级分类默认全部需要 Pro。 */
export const PREMIUM_EFFECT_CATEGORY: EffectCategory = "高级";

/** 动效库分类展示顺序，高级固定排在最后。 */
export const EFFECT_CATEGORY_ORDER = [
  "背景", "展示", "场景", "标题", "强调", "卡片", "标注", "数据", "布局", "高级"
] as const satisfies readonly EffectCategory[];

export type EffectTier = "free" | "pro";

/**
 * 按动效库顺序给每个动效分配免费/Pro 档位。
 * 只传入内置库（`BUILTIN_EFFECTS`）：顺序稳定，搜索、筛选和已安装的扩展动效包都不会改变档位，
 * 扩展包动效也不会挤占分类内的免费名额。
 */
export function effectTierMap(library: readonly CompositionDefinition[]): ReadonlyMap<string, EffectTier> {
  const tiers = new Map<string, EffectTier>();
  const seenPerCategory = new Map<EffectCategory, number>();
  for (const effect of library) {
    if (coreFreeEffectIdSet.has(effect.id)) {
      tiers.set(effect.id, "free");
      continue;
    }
    if (effect.category === PREMIUM_EFFECT_CATEGORY) {
      tiers.set(effect.id, "pro");
      continue;
    }
    const index = seenPerCategory.get(effect.category) ?? 0;
    seenPerCategory.set(effect.category, index + 1);
    tiers.set(effect.id, index < FREE_EFFECTS_PER_CATEGORY ? "free" : "pro");
  }
  return tiers;
}

/**
 * 读取单个动效的档位。未收录在库里的动效（例如用户自行安装的扩展动效包）
 * 默认免费；只有明确落在高级分类时才按 Pro 处理。
 */
export function effectTier(effect: CompositionDefinition, tiers: ReadonlyMap<string, EffectTier>): EffectTier {
  return tiers.get(effect.id) ?? (effect.category === PREMIUM_EFFECT_CATEGORY ? "pro" : "free");
}

export function canUseEffect(tier: EffectTier, isPro: boolean): boolean {
  return tier === "free" || isPro;
}
