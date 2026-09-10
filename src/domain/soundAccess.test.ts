import { describe, expect, it } from "vitest";
import catalog from "@/domain/shotcraftLibrary/audioCatalog.json";
import {
  canUseSound,
  FREE_MUSIC_TRACKS,
  FREE_SOUNDS_PER_CATEGORY,
  MUSIC_SOUND_CATEGORY,
  SOUND_CATEGORY_BY_SOURCE,
  SOUND_CATEGORY_ORDER,
  soundCategory,
  soundDisplayName,
  soundFreeQuota,
  soundTier,
  soundTierMap
} from "./soundAccess";

describe("sound access", () => {
  it("把目录里的原始分类全部映射到 8 个常规分类 + 音乐", () => {
    const sources = new Set(catalog.map((item) => item.category));
    for (const source of sources) expect(SOUND_CATEGORY_BY_SOURCE).toHaveProperty(source);
    expect(new Set([...sources].map(soundCategory))).toEqual(new Set(SOUND_CATEGORY_ORDER));
    expect(SOUND_CATEGORY_ORDER.filter((category) => category !== MUSIC_SOUND_CATEGORY)).toHaveLength(8);
    expect(SOUND_CATEGORY_ORDER[SOUND_CATEGORY_ORDER.length - 1]).toBe(MUSIC_SOUND_CATEGORY);
  });

  it("常规分类前 5 个免费、第 6 个起需要 Pro，音乐前 2 首免费", () => {
    const tiers = soundTierMap(catalog);
    for (const category of SOUND_CATEGORY_ORDER.filter((item) => item !== MUSIC_SOUND_CATEGORY)) {
      const ids = catalog.filter((item) => soundCategory(item.category) === category).map((item) => item.id);
      expect(ids.length).toBeGreaterThan(FREE_SOUNDS_PER_CATEGORY);
      expect(ids.slice(0, FREE_SOUNDS_PER_CATEGORY).every((id) => tiers.get(id) === "free")).toBe(true);
      expect(ids.slice(FREE_SOUNDS_PER_CATEGORY).every((id) => tiers.get(id) === "pro")).toBe(true);
    }

    const musicIds = catalog.filter((item) => soundCategory(item.category) === MUSIC_SOUND_CATEGORY).map((item) => item.id);
    expect(musicIds.length).toBeGreaterThan(FREE_MUSIC_TRACKS);
    expect(musicIds.slice(0, FREE_MUSIC_TRACKS).every((id) => tiers.get(id) === "free")).toBe(true);
    expect(musicIds.slice(FREE_MUSIC_TRACKS).every((id) => tiers.get(id) === "pro")).toBe(true);
    expect(soundFreeQuota(MUSIC_SOUND_CATEGORY)).toBe(FREE_MUSIC_TRACKS);
    expect(soundFreeQuota("转场")).toBe(FREE_SOUNDS_PER_CATEGORY);
  });

  it("搜索或筛选不影响档位，目录外的音效按分类兜底", () => {
    const tiers = soundTierMap(catalog);
    const firstTransition = catalog.find((item) => soundCategory(item.category) === "转场")!;
    expect(soundTier(firstTransition, tiers)).toBe("free");
    expect(soundTier({ id: "unknown-sound", name: "冲击 · unknown", category: "impact", durationUs: 0 }, tiers)).toBe("free");
    expect(soundTier({ id: "unknown-music", name: "音乐 · unknown", category: "bgm", durationUs: 0 }, tiers)).toBe("pro");
  });

  it("按会员状态解锁 Pro 音效", () => {
    expect(canUseSound("free", false)).toBe(true);
    expect(canUseSound("free", true)).toBe(true);
    expect(canUseSound("pro", false)).toBe(false);
    expect(canUseSound("pro", true)).toBe(true);
  });

  it("展示名与分组后的分类保持一致", () => {
    const film = catalog.find((item) => item.category === "film")!;
    expect(soundDisplayName(film)).toBe(`质感 · ${film.name.split(" · ")[1]}`);
    const music = catalog.find((item) => item.category === "bgm")!;
    expect(soundDisplayName(music)).toBe(`音乐 · ${music.name.split(" · ")[1]}`);
  });
});
