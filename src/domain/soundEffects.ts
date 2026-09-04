export type BuiltinSoundCategory = "转场" | "强调" | "氛围";

export interface BuiltinSoundEffect {
  id: string;
  name: string;
  category: BuiltinSoundCategory;
  description: string;
  tags: string[];
  durationUs: number;
}

export const BUILTIN_SOUND_EFFECT_IDS = ["intro-impact", "soft-whoosh", "quick-swish", "clean-click", "soft-pop", "notice-chime", "suspense-rise", "comic-bounce", "success-tone"] as const;
export type BuiltinSoundEffectId = typeof BUILTIN_SOUND_EFFECT_IDS[number];

export const BUILTIN_SOUND_EFFECTS = [
  { id: "soft-whoosh", name: "丝滑转场", category: "转场", description: "宽幅掠过，适合 B-roll、章节和画面切换", tags: ["转场", "切换", "B-roll", "章节", "滑入"], durationUs: 680_000 },
  { id: "quick-swish", name: "快切甩镜", category: "转场", description: "利落短扫，适合快切、甩镜和缩放转场", tags: ["快切", "甩镜", "缩放", "转场", "节奏"], durationUs: 380_000 },
  { id: "intro-impact", name: "片头冲击", category: "强调", description: "低频冲击与空气尾音，适合片头标题落版", tags: ["片头", "标题", "开场", "冲击", "落版"], durationUs: 820_000 },
  { id: "clean-click", name: "字幕弹出", category: "强调", description: "短促弹点，适合关键词、字幕和贴纸出现", tags: ["字幕", "关键词", "贴纸", "弹出", "出现"], durationUs: 220_000 },
  { id: "soft-pop", name: "重点重音", category: "强调", description: "紧凑低频重音，适合数字、结论和重点卡片", tags: ["重点", "数字", "结论", "强调", "卡片"], durationUs: 460_000 },
  { id: "notice-chime", name: "高光闪亮", category: "氛围", description: "清亮闪烁，适合高光、推荐和惊喜时刻", tags: ["高光", "推荐", "惊喜", "闪亮", "种草"], durationUs: 900_000 },
  { id: "suspense-rise", name: "悬念上升", category: "氛围", description: "渐强上扬，适合答案揭晓前和情绪推进", tags: ["悬念", "揭晓", "反转", "渐强", "期待"], durationUs: 1_250_000 },
  { id: "comic-bounce", name: "轻松弹跳", category: "氛围", description: "俏皮弹跳，适合轻松吐槽和趣味反应", tags: ["轻松", "吐槽", "趣味", "反应", "弹跳"], durationUs: 620_000 },
  { id: "success-tone", name: "片尾收束", category: "氛围", description: "温暖解决和弦，适合总结、关注引导和片尾", tags: ["片尾", "总结", "关注", "完成", "收束"], durationUs: 1_050_000 }
] as const satisfies readonly (BuiltinSoundEffect & { id: BuiltinSoundEffectId })[];

export function builtinSoundEffectById(soundId: string): BuiltinSoundEffect | undefined {
  return BUILTIN_SOUND_EFFECTS.find((sound) => sound.id === soundId);
}

export function builtinSoundAssetId(soundId: string): string {
  return `builtin-sound:${soundId}`;
}

export function builtinSoundIdFromAssetId(assetId: string): BuiltinSoundEffectId | undefined {
  const soundId = assetId.startsWith("builtin-sound:") ? assetId.slice("builtin-sound:".length) : "";
  return BUILTIN_SOUND_EFFECT_IDS.find((candidate) => candidate === soundId);
}
