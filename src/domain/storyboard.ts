import { compositionById } from "@/domain/effects";
import { motionMatchingProfile } from "@/domain/motionMatching";
import type { EditorProject } from "@/domain/project";

export type StoryboardRole = "a-roll" | "b-roll";
export interface StoryboardOptions { mode: "auto" | StoryboardRole; prompt: string }
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
