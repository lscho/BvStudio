import { compositionSlots } from "@/domain/compositions";
import { compositionById } from "@/domain/effects";
import { motionMatchingProfile } from "@/domain/motionMatching";
import type { EditorProject } from "@/domain/project";
import { isShotcraftComposition, type ShotcraftTextMode } from "@/domain/shotcraft";

export type StoryboardRole = "a-roll" | "b-roll";
export interface StoryboardOptions { mode: "auto" | StoryboardRole; prompt: string; shotcraftTextMode?: ShotcraftTextMode }
export interface StoryboardCue { startSeconds: number; endSeconds: number; role: StoryboardRole }
export interface StoryboardVisual { assetId?: string; startSeconds: number; endSeconds: number; role: string; description: string }

export function storyboardVisuals(project: EditorProject): StoryboardVisual[] {
  const sourceIds = new Set(project.tracks.flatMap((track) => track.clips).flatMap((clip) => clip.kind === "subtitle" && clip.sourceAssetId ? [clip.sourceAssetId] : []));
  return project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips.flatMap((clip): StoryboardVisual[] => {
    if (clip.kind === "video" && project.assets.some((asset) => asset.id === clip.assetId && !asset.missing) && (clip.transform?.opacity ?? 1) > 0) return [{ assetId: clip.assetId, startSeconds: clip.startUs / 1_000_000, endSeconds: (clip.startUs + clip.durationUs) / 1_000_000, role: clip.role && clip.role !== "unspecified" ? clip.role : sourceIds.has(clip.assetId) ? "a-roll" : "unspecified", description: clip.label.slice(0, 160) }];
    if (clip.kind === "composition") return [{ startSeconds: clip.startUs / 1_000_000, endSeconds: (clip.startUs + clip.durationUs) / 1_000_000, role: motionMatchingProfile(compositionById(clip.compositionId)).usage, description: `${clip.compositionId}：${clip.text}；${clip.bindings?.flatMap((binding) => binding.assetIds).map((id) => project.assets.find((asset) => asset.id === id)?.name ?? "").join("、") ?? ""}`.slice(0, 500) }];
    return [];
  }));
}

export function parseStoryboardCues(prompt: string, durationSeconds: number): StoryboardCue[] {
  const pattern = /(\d+(?::\d{1,2})?(?:\.\d+)?)\s*(?:秒|s)?\s*[-–—~～至到]\s*(\d+(?::\d{1,2})?(?:\.\d+)?)\s*(?:秒|s)?\s*[:：]?\s*([ab])\s*-?\s*roll/giu;
  const seconds = (text: string) => text.split(":").reduce((sum, value) => sum * 60 + Number(value), 0);
  const cues: StoryboardCue[] = [...prompt.matchAll(pattern)].map((match) => ({ startSeconds: seconds(match[1]), endSeconds: seconds(match[2]), role: match[3].toLowerCase() === "a" ? "a-roll" : "b-roll" }));
  cues.sort((a, b) => a.startSeconds - b.startSeconds);
  for (const [i, cue] of cues.entries()) {
    if (cue.endSeconds <= cue.startSeconds) throw new Error("分镜时间范围必须从早到晚");
    if (cue.endSeconds > durationSeconds) throw new Error("分镜要求超出工程时长，请调整时间范围");
    if (i && cue.startSeconds < cues[i - 1].endSeconds) throw new Error("分镜时间要求存在重叠，请合并或调整");
  }
  return cues;
}

export function storyboardRoleAt(caption: { startSeconds: number; endSeconds: number }, options: StoryboardOptions, cues: readonly StoryboardCue[]) {
  const middle = (caption.startSeconds + caption.endSeconds) / 2;
  const cue = cues.find((entry) => entry.startSeconds <= middle && middle < entry.endSeconds);
  if (cue && options.mode !== "auto" && cue.role !== options.mode) throw new Error("分镜时间要求与纯 A-roll／B-roll 模式冲突，请调整模式或要求");
  return options.mode === "auto" ? cue?.role : options.mode;
}

export function storyboardEffectAllowed(effectId: string, role: StoryboardRole) {
  const profile = motionMatchingProfile(compositionById(effectId));
  return role === "a-roll" ? profile.usage !== "fullscreen" && !profile.exclusive : profile.usage !== "talking-head";
}

export function storyboardShotcraftCardAllowed(primaryEffectId: string, secondaryEffectId: string) {
  return isShotcraftComposition(primaryEffectId) && !storyboardInformationCardIssue(secondaryEffectId);
}

export function storyboardInformationCardIssue(effectId: string): string | undefined {
  if (isShotcraftComposition(effectId)) return "另一个 Shotcraft 全屏镜头不能作为辅助信息卡";
  const definition = compositionById(effectId);
  const profile = motionMatchingProfile(definition);
  if (compositionSlots(effectId).length > 0) return "该动效需要绑定素材，不能作为无素材信息卡";
  if (definition.recipe.sceneBackground || profile.layerRole === "background") return "背景动效不能充当信息卡";
  if (!["卡片", "数据", "布局"].includes(definition.category)) return `该动效属于“${definition.category}”，信息卡只接受卡片、数据或布局分类`;
  if (profile.usage !== "both") return `该动效适用范围为 ${profile.usage}，叠加卡必须同时适用于口播和全屏（both）`;
  if (profile.exclusive || profile.layerRole !== "content") return "该动效不是可叠加的非独占内容层";
  return undefined;
}
