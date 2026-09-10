// 音效可用性规则：8 个常规分类内前 5 个免费，音乐分类前 2 首免费，其余需要 Pro。
// 规则说明见 docs/13-音效分类与Pro可用性约束.md。
export type SoundTier = "free" | "pro";

/** 资源面板「音效」页展示的分类顺序；音乐固定排在最后。 */
export const SOUND_CATEGORY_ORDER = [
  "转场", "冲击", "交互", "文字", "氛围", "数据", "质感", "相机", "音乐"
] as const;
export type SoundCategory = (typeof SOUND_CATEGORY_ORDER)[number];

/** 每个常规分类免费开放的音效数量；该分类第 6 个起需要 Pro。 */
export const FREE_SOUNDS_PER_CATEGORY = 5;

/** 音乐分类免费开放的曲目数量；第 3 首起需要 Pro。 */
export const FREE_MUSIC_TRACKS = 2;

/** 音乐单独成类，免费额度与常规分类不同。 */
export const MUSIC_SOUND_CATEGORY: SoundCategory = "音乐";

/**
 * Shotcraft 音频目录的原始分类 → 资源面板展示分类。
 * 原始分类保留在目录里，供 AI 编排和素材哈希校验继续使用。
 */
export const SOUND_CATEGORY_BY_SOURCE = {
  transition: "转场",
  riser: "转场",
  impact: "冲击",
  mech: "冲击",
  glass: "冲击",
  ui: "交互",
  counter: "交互",
  text: "文字",
  paper: "文字",
  light: "氛围",
  scifi: "氛围",
  crowd: "氛围",
  data: "数据",
  film: "质感",
  fluid: "质感",
  camera: "相机",
  bgm: "音乐"
} as const satisfies Record<string, SoundCategory>;

export type SourceSoundCategory = keyof typeof SOUND_CATEGORY_BY_SOURCE;

export interface SoundCatalogItem {
  id: string;
  name: string;
  category: string;
  durationUs: number;
}

/** 未登记的原始分类归入「氛围」，避免新增素材导致界面空白。 */
export function soundCategory(sourceCategory: string): SoundCategory {
  return SOUND_CATEGORY_BY_SOURCE[sourceCategory as SourceSoundCategory] ?? "氛围";
}

/** 分类的免费额度：音乐 2 首，其余常规分类 5 个。 */
export function soundFreeQuota(category: SoundCategory): number {
  return category === MUSIC_SOUND_CATEGORY ? FREE_MUSIC_TRACKS : FREE_SOUNDS_PER_CATEGORY;
}

/**
 * 按展示分类顺序给每个音效分配免费/Pro 档位。
 * 顺序以传入目录（`SHOTCRAFT_AUDIO`）为准，每个分类的免费额度由 `soundFreeQuota` 决定。
 */
export function soundTierMap(catalog: readonly SoundCatalogItem[]): ReadonlyMap<string, SoundTier> {
  const tiers = new Map<string, SoundTier>();
  const seenPerCategory = new Map<SoundCategory, number>();
  for (const sound of catalog) {
    const category = soundCategory(sound.category);
    const index = seenPerCategory.get(category) ?? 0;
    seenPerCategory.set(category, index + 1);
    tiers.set(sound.id, index < soundFreeQuota(category) ? "free" : "pro");
  }
  return tiers;
}

/** 读取单个音效的档位；目录外的音效按分类兜底。 */
export function soundTier(sound: SoundCatalogItem, tiers: ReadonlyMap<string, SoundTier>): SoundTier {
  return tiers.get(sound.id) ?? (soundCategory(sound.category) === MUSIC_SOUND_CATEGORY ? "pro" : "free");
}

export function canUseSound(tier: SoundTier, isPro: boolean): boolean {
  return tier === "free" || isPro;
}

/** 展示名：把原始分类前缀改写为分组后的分类名，保证分组与条目命名一致。 */
export function soundDisplayName(sound: SoundCatalogItem): string {
  const separator = sound.name.indexOf(" · ");
  const slug = separator >= 0 ? sound.name.slice(separator + 3) : sound.name;
  return `${soundCategory(sound.category)} · ${slug}`;
}
