import { create } from "zustand";
import { BUILTIN_EFFECTS, effectById, recommendedEffectFontSize } from "@/domain/effects";
import { cameraMotionForPreset } from "@/domain/camera";
import { timedTextSegments } from "@/domain/captions";
import { createGeneratedEffectLayers } from "@/domain/sceneEffects";
import { resolveMotionLayout, type MotionLayoutLayer } from "@/domain/motionLayout";
import { motionColorRoleForEffect, motionThemeAccentColor } from "@/domain/motionTheme";
import { DEFAULT_TRANSFORM, videoLayoutForPreset, visualTransformAt } from "@/domain/transforms";
import {
  createEmptyProject,
  projectEndUs,
  type AudioClip,
  type AudioRole,
  type ChapterProgressSettings,
  type EditorProject,
  type EffectClip,
  type GeneratedBlock,
  type ImageClip,
  type InsertMode,
  type MediaAsset,
  type MotionTheme,
  type SceneClip,
  type SubtitleClip,
  type TimelineClip,
  type TimelineTrack,
  type VideoClip,
  type VideoMotionPresetId,
  type VideoPresentationCue
} from "@/domain/project";
import type { AiMotionMatch, AiVideoPlan } from "@/services/ai/schema";
import { createVideoPresentationCue, DEFAULT_EFFECT_BACKDROP, DEFAULT_VIDEO_FOCUS, DEFAULT_VIDEO_MASK, DEFAULT_VIDEO_TRANSITION, videoPresentationAt } from "@/domain/videoPresentation";
import { DEFAULT_SUBTITLE_STYLE, subtitleKeywordsForText } from "@/domain/videoDecorations";
import { builtinSoundAssetId, builtinSoundEffectById } from "@/domain/soundEffects";

export type SubtitleAppearancePatch = Partial<Pick<
  SubtitleClip,
  | "stylePreset"
  | "highlightColor"
  | "outlineColor"
  | "outlineWidth"
  | "backgroundOpacity"
  | "borderRadius"
  | "color"
  | "backgroundColor"
  | "fontSize"
  | "positionY"
>>;

function aiEffectScale(matchScale: number, hasChart: boolean) {
  return Math.max(hasChart ? 0.8 : 0.65, Math.min(2.5, matchScale));
}

type AiMotionEntrySlot = "primary" | "secondary";

interface AiMotionEntry {
  slot: AiMotionEntrySlot;
  effectId: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
}

interface AiMotionCaptionSpan {
  startUs: number;
  endUs: number;
  text: string;
  fontSize: number;
  positionY: number;
}

function aiMotionLayoutId(captionIndex: number, slot: AiMotionEntrySlot) {
  return `${captionIndex}:${slot}`;
}

function aiMotionEntries(match: AiMotionMatch, captionText: string, useCaptionFallback: boolean): AiMotionEntry[] {
  const primaryDefinition = match.primaryEffectId ? effectById(match.primaryEffectId) : null;
  const primaryText = primaryDefinition?.recipe.sceneBackground
    ? ""
    : match.primaryText.trim() || (useCaptionFallback ? captionText : "");
  return [
    primaryDefinition && (primaryText || primaryDefinition.recipe.sceneBackground)
      ? { slot: "primary", effectId: primaryDefinition.id, text: primaryText, x: match.x, y: match.y, scale: match.scale, zIndex: 20 }
      : null,
    match.secondaryEffectId && match.secondaryText?.trim()
      ? { slot: "secondary", effectId: match.secondaryEffectId, text: match.secondaryText.trim(), x: match.secondaryX, y: match.secondaryY, scale: Math.min(1.5, match.scale), zIndex: 30 }
      : null
  ].filter((entry): entry is AiMotionEntry => Boolean(entry));
}

function materializedAiEffectRecipe(effectId: string, match: AiMotionMatch) {
  const recipe = structuredClone(effectById(effectId).recipe);
  if (recipe.chart && match.chart) {
    recipe.chart = recipe.chart.kind === "counter"
      ? { ...recipe.chart, endValue: match.chart.series[0] ?? 0, unit: match.chart.unit, suffix: match.chart.unit }
      : { ...recipe.chart, categories: match.chart.categories, series: match.chart.series, unit: match.chart.unit };
  }
  return recipe;
}

function subtitleSafeAreaTop(caption: AiMotionCaptionSpan, canvas: EditorProject["canvas"]) {
  const charactersPerLine = Math.max(8, Math.floor(canvas.width * 0.8 / Math.max(1, caption.fontSize)));
  const lines = Math.max(1, Math.ceil(Array.from(caption.text).length / charactersPerLine));
  const textHeightPercent = caption.fontSize * 1.35 * lines / Math.max(1, canvas.height) * 100;
  return Math.max(10, Math.min(78, caption.positionY - textHeightPercent - 3));
}

function resolveAiMotionPlacements(
  project: EditorProject,
  matches: readonly AiMotionMatch[],
  captions: readonly AiMotionCaptionSpan[],
  useCaptionFallback: boolean,
  existingEffects: readonly EffectClip[]
) {
  const matchByCaption = new Map(matches.map((match) => [match.captionIndex, match]));
  const layers: MotionLayoutLayer[] = [];
  for (let captionIndex = 0; captionIndex < captions.length; captionIndex += 1) {
    const match = matchByCaption.get(captionIndex);
    const caption = captions[captionIndex];
    if (!match || !caption) continue;
    const persistUntilCaptionIndex = match.motionGroupId
      ? Math.min(captions.length - 1, Math.max(captionIndex, match.persistUntilCaptionIndex ?? captionIndex))
      : captionIndex;
    const endUs = captions[persistUntilCaptionIndex]?.endUs ?? caption.endUs;
    for (const entry of aiMotionEntries(match, caption.text, useCaptionFallback)) {
      const recipe = materializedAiEffectRecipe(entry.effectId, match);
      if (recipe.sceneBackground) continue;
      layers.push({
        id: aiMotionLayoutId(captionIndex, entry.slot),
        startUs: caption.startUs,
        durationUs: Math.max(100_000, endUs - caption.startUs),
        desiredX: entry.x,
        desiredY: entry.y,
        scale: aiEffectScale(entry.scale, Boolean(recipe.chart)),
        fontSize: recommendedEffectFontSize(recipe, entry.text),
        text: entry.text,
        recipe,
        priority: entry.slot
      });
    }
  }
  const occupiedLayers = existingEffects.map((effect) => {
    const recipe = effect.recipe ?? effectById(effect.effectId).recipe;
    return {
      layer: {
        id: `existing:${effect.id}`,
        startUs: effect.startUs,
        durationUs: effect.durationUs,
        desiredX: effect.transform.x,
        desiredY: effect.transform.y,
        scale: effect.transform.scale,
        fontSize: effect.fontSize,
        text: effect.text,
        recipe,
        priority: "primary" as const
      },
      placement: { x: effect.transform.x, y: effect.transform.y, scale: effect.transform.scale }
    };
  });
  const safeAreas = captions.map((caption) => ({
    startUs: caption.startUs,
    durationUs: Math.max(100_000, caption.endUs - caption.startUs),
    rect: { left: 0, top: subtitleSafeAreaTop(caption, project.canvas), right: 100, bottom: 100 }
  }));
  if (captions.length && project.chapterProgress.enabled && project.chapterProgress.chapters.length) {
    const firstStartUs = Math.min(...captions.map((caption) => caption.startUs));
    const lastEndUs = Math.max(...captions.map((caption) => caption.endUs));
    const progressRatio = project.chapterProgress.height / Math.max(1, project.canvas.height) * 100 + 2;
    safeAreas.push({
      startUs: firstStartUs,
      durationUs: Math.max(100_000, lastEndUs - firstStartUs),
      rect: project.chapterProgress.position === "top"
        ? { left: 0, top: 0, right: 100, bottom: progressRatio }
        : { left: 0, top: 100 - progressRatio, right: 100, bottom: 100 }
    });
  }
  return resolveMotionLayout({ canvas: project.canvas, layers, safeAreas, occupiedLayers });
}

interface EditorState {
  project: EditorProject;
  selectedClipId: string | null;
  selectedClipIds: string[];
  playheadUs: number;
  zoom: number;
  rangeStartUs: number | null;
  rangeEndUs: number | null;
  past: EditorProject[];
  future: EditorProject[];
  selectClip: (clipId: string | null, additive?: boolean) => void;
  setPlayhead: (timeUs: number) => void;
  setZoom: (zoom: number) => void;
  setRangeStart: (timeUs: number | null) => void;
  setRangeEnd: (timeUs: number | null) => void;
  clearRange: () => void;
  updateCanvas: (canvas: EditorProject["canvas"]) => void;
  updateMotionTheme: (patch: Partial<Omit<MotionTheme, "colors">> & { colors?: Partial<MotionTheme["colors"]> }) => void;
  updateChapterProgress: (patch: Partial<ChapterProgressSettings>) => void;
  addEffect: (effectId: string) => void;
  addVideo: (asset: MediaAsset) => void;
  addImage: (asset: MediaAsset) => void;
  addAudio: (asset: MediaAsset, role?: AudioRole, startUs?: number, sourceBlockId?: string) => void;
  addExtractedAudio: (asset: MediaAsset, sourceVideoAssetId: string) => void;
  placeAsset: (assetId: string, placement?: "auto" | "main" | "overlay") => void;
  updateAsset: (assetId: string, patch: Partial<MediaAsset>) => void;
  replaceProject: (project: EditorProject) => void;
  addGeneratedPlan: (plan: AiVideoPlan, prompt: string, mode: InsertMode, target?: { startUs: number; durationUs?: number }) => string;
  applyMotionMatches: (subtitleIds: string[], matches: AiMotionMatch[], soundAssets?: MediaAsset[]) => void;
  alignGeneratedBlockDuration: (blockId: string, durationUs: number) => void;
  alignGeneratedSceneDurations: (blockId: string, durationsUs: number[], subtitleIds?: string[]) => void;
  updateEffect: (clipId: string, patch: Partial<EffectClip>) => void;
  updateScene: (clipId: string, patch: Partial<SceneClip>) => void;
  updateVideo: (clipId: string, patch: Partial<VideoClip>) => void;
  addVideoPresentationCue: (clipId: string, presetId: VideoMotionPresetId, offsetUs: number) => void;
  updateVideoPresentationCue: (clipId: string, cueId: string, patch: Partial<VideoPresentationCue>) => void;
  removeVideoPresentationCue: (clipId: string, cueId: string) => void;
  updateImage: (clipId: string, patch: Partial<ImageClip>) => void;
  updateAudio: (clipId: string, patch: Partial<AudioClip>) => void;
  updateGenerated: (clipId: string, patch: Partial<GeneratedBlock>) => void;
  updateGeneratedScene: (clipId: string, sceneId: string, patch: Partial<GeneratedBlock["scenes"][number]>) => void;
  addSubtitles: (assetId: string, segments: Array<{ startSeconds: number; endSeconds: number; text: string }>) => void;
  updateSubtitle: (clipId: string, patch: Partial<SubtitleClip>) => void;
  updateSubtitleAppearance: (clipId: string | null, patch: SubtitleAppearancePatch) => void;
  moveClips: (clipIds: string[], deltaUs: number) => void;
  trimClip: (clipId: string, edge: "start" | "end", deltaUs: number) => void;
  splitSelected: () => void;
  copySelected: () => void;
  pasteAtPlayhead: () => void;
  setTrackState: (trackId: string, patch: { locked?: boolean; muted?: boolean; hidden?: boolean }) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  clipboard: TimelineClip[];
  focusPickClipId: string | null;
  previewRequest: { id: number; startUs: number; endUs: number } | null;
  setFocusPickClip: (clipId: string | null) => void;
  requestPreview: (startUs: number, endUs: number) => void;
}

function cloneProject(project: EditorProject): EditorProject {
  return structuredClone(project);
}

function isSourceClip(clip: TimelineClip): clip is VideoClip | AudioClip {
  return clip.kind === "video" || clip.kind === "audio";
}

function findClip(project: EditorProject, clipId: string | null): TimelineClip | null {
  if (!clipId) return null;
  return project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId) ?? null;
}

export function expandSceneGroupClipIds(project: EditorProject, clipIds: readonly string[]): string[] {
  const selected = new Set(clipIds);
  const groups = new Set(project.tracks.flatMap((track) => track.clips).flatMap((clip) => (
    selected.has(clip.id) && (clip.kind === "effect" || clip.kind === "scene") && clip.sceneGroupId ? [clip.sceneGroupId] : []
  )));
  if (!groups.size) return [...selected];
  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if ((clip.kind === "effect" || clip.kind === "scene") && clip.sceneGroupId && groups.has(clip.sceneGroupId)) selected.add(clip.id);
  }
  return [...selected];
}

function stretchSceneGroup(project: EditorProject, clip: EffectClip | SceneClip, edge: "start" | "end", deltaUs: number) {
  if (!clip.sceneGroupId) return false;
  const members = project.tracks.flatMap((track) => track.clips.map((candidate) => ({ candidate, track })))
    .filter((entry): entry is { candidate: EffectClip | SceneClip; track: TimelineTrack } => (
      (entry.candidate.kind === "effect" || entry.candidate.kind === "scene") && entry.candidate.sceneGroupId === clip.sceneGroupId
    ));
  if (members.length < 2 || members.some(({ candidate, track }) => candidate.locked || track.locked)) return members.length >= 2;
  const groupStartUs = Math.min(...members.map(({ candidate }) => candidate.startUs));
  const groupEndUs = Math.max(...members.map(({ candidate }) => candidate.startUs + candidate.durationUs));
  const spanUs = Math.max(100_000, groupEndUs - groupStartUs);
  const nextStartUs = edge === "start" ? Math.max(0, Math.min(groupEndUs - 100_000, groupStartUs + deltaUs)) : groupStartUs;
  const nextEndUs = edge === "end" ? Math.max(groupStartUs + 100_000, groupEndUs + deltaUs) : groupEndUs;
  const ratio = (nextEndUs - nextStartUs) / spanUs;
  for (const { candidate } of members) {
    candidate.startUs = Math.round(nextStartUs + (candidate.startUs - groupStartUs) * ratio);
    candidate.durationUs = Math.max(100_000, Math.round(candidate.durationUs * ratio));
    if (candidate.dimAtUs !== undefined) candidate.dimAtUs = Math.round(candidate.dimAtUs * ratio);
    candidate.soundCues = candidate.soundCues?.map((cue) => ({ ...cue, offsetUs: Math.round(cue.offsetUs * ratio), durationUs: Math.max(50_000, Math.round(cue.durationUs * ratio)) }));
    if (candidate.kind === "effect" && candidate.transformKeyframes?.length) {
      candidate.transformKeyframes = candidate.transformKeyframes.map((frame) => ({ ...frame, offsetUs: Math.round(frame.offsetUs * ratio) }));
    }
  }
  return true;
}

function videoTrackForPlacement(project: EditorProject, startUs: number, _placement: "auto" | "main" | "overlay" = "auto", durationUs = 1): TimelineTrack {
  const videoTracks = project.tracks.filter((track) => track.kind === "video");
  const endUs = startUs + Math.max(1, durationUs);
  const preferred = videoTracks.find((track) => !track.clips.some((clip) => startUs < clip.startUs + clip.durationUs && endUs > clip.startUs));
  if (preferred) return preferred;
  const track: TimelineTrack = {
    id: `video-layer-${crypto.randomUUID()}`,
    kind: "video",
    name: "视频",
    locked: false,
    muted: false,
    hidden: false,
    clips: []
  };
  const imageIndex = project.tracks.findIndex((candidate) => candidate.kind === "image");
  project.tracks.splice(imageIndex < 0 ? videoTracks.length : imageIndex, 0, track);
  return track;
}

function effectBackdropForPreset(preset: AiMotionMatch["backdropPreset"], accentColor: string) {
  if (preset === "none") return { ...DEFAULT_EFFECT_BACKDROP };
  if (preset === "light") return { ...DEFAULT_EFFECT_BACKDROP, opacity: 0.48, blur: 12 };
  if (preset === "soft") return { ...DEFAULT_EFFECT_BACKDROP, opacity: 0.56, blur: 12 };
  if (preset === "accent") return { ...DEFAULT_EFFECT_BACKDROP, color: accentColor, opacity: 0.42, blur: 10 };
  return { ...DEFAULT_EFFECT_BACKDROP, enabled: true };
}

function matchedVideoLayers(match: AiMotionMatch, legacyPrimaryLayout: VideoClip["layoutPreset"] = match.mediaLayoutPreset) {
  if (match.videoLayers?.length) return match.videoLayers;
  const layers: AiMotionMatch["videoLayers"] = [];
  if (match.primaryMediaAssetId) layers.push({
    assetId: match.primaryMediaAssetId, role: "b-roll", sourceInSeconds: match.primaryMediaSourceInSeconds,
    layoutPreset: legacyPrimaryLayout ?? "full", shapePreset: "rectangle", transitionPreset: "fade",
    cameraPreset: match.cameraPreset, volume: 0, focus: null
  });
  if (match.secondaryMediaAssetId) layers.push({
    assetId: match.secondaryMediaAssetId, role: "supporting", sourceInSeconds: match.secondaryMediaSourceInSeconds,
    layoutPreset: match.mediaLayoutPreset === "full" ? "picture-in-picture-top-right" : match.mediaLayoutPreset,
    shapePreset: "rounded", transitionPreset: "zoom", cameraPreset: "none", volume: 0, focus: null
  });
  return layers;
}

function videoClipFields(project: EditorProject, startUs: number, placement: "auto" | "main" | "overlay" = "auto") {
  const active = project.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video" && startUs >= clip.startUs && startUs < clip.startUs + clip.durationUs);
  const first = active.length === 0;
  const preset = first && placement !== "overlay" ? "full" : "picture-in-picture-top-right";
  const layout = videoLayoutForPreset(preset, 1_000_000);
  const zIndex = first ? 0 : Math.max(0, ...active.map((clip) => clip.zIndex ?? 0)) + 10;
  return {
    zIndex,
    transform: layout.transform,
    transformKeyframes: layout.transformKeyframes,
    layoutPreset: preset as VideoClip["layoutPreset"],
    volume: first ? 1 : 0,
    role: first ? "a-roll" as const : "b-roll" as const,
    mask: { ...DEFAULT_VIDEO_MASK },
    transition: { ...DEFAULT_VIDEO_TRANSITION }
  };
}

function splitVideoKeyframes(clip: VideoClip, atUs: number) {
  const base = clip.transform ?? DEFAULT_TRANSFORM;
  const boundary = visualTransformAt(base, clip.transformKeyframes, atUs);
  const leading = [...(clip.transformKeyframes ?? []).filter((frame) => frame.offsetUs < atUs), { offsetUs: atUs, x: boundary.x, y: boundary.y, scale: boundary.scale, easing: "ease-in-out" as const }];
  const trailing = [{ offsetUs: 0, x: boundary.x, y: boundary.y, scale: boundary.scale, easing: "ease-in-out" as const }, ...(clip.transformKeyframes ?? []).filter((frame) => frame.offsetUs > atUs).map((frame) => ({ ...frame, offsetUs: frame.offsetUs - atUs }))];
  return { leading, trailing };
}

function trimGeneratedStart(clip: GeneratedBlock, deltaUs: number) {
  if (deltaUs < 0) {
    if (clip.scenes[0]) clip.scenes[0].durationUs -= deltaUs;
    return;
  }
  let remaining = deltaUs;
  const scenes = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    if (remaining >= scene.durationUs) {
      remaining -= scene.durationUs;
    } else {
      scenes.push({ ...scene, durationUs: scene.durationUs - remaining });
      remaining = 0;
    }
  }
  clip.scenes = scenes.length ? scenes : clip.scenes.slice(-1).map((scene) => ({ ...scene, durationUs: 100_000 }));
}

function trimGeneratedEnd(clip: GeneratedBlock, targetDurationUs: number) {
  let remaining = targetDurationUs;
  const scenes = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    if (remaining <= 0) break;
    const durationUs = Math.min(scene.durationUs, remaining);
    scenes.push({ ...scene, durationUs });
    remaining -= durationUs;
  }
  if (remaining > 0 && scenes.length) scenes[scenes.length - 1].durationUs += remaining;
  clip.scenes = scenes.length ? scenes : clip.scenes.slice(0, 1).map((scene) => ({ ...scene, durationUs: targetDurationUs }));
}

function splitGeneratedScenes(clip: GeneratedBlock, atUs: number) {
  let cursor = 0;
  const leading = [] as GeneratedBlock["scenes"];
  const trailing = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    const sceneEnd = cursor + scene.durationUs;
    if (sceneEnd <= atUs) {
      leading.push(scene);
    } else if (cursor >= atUs) {
      trailing.push({ ...scene, id: crypto.randomUUID() });
    } else {
      leading.push({ ...scene, durationUs: atUs - cursor });
      trailing.push({ ...scene, id: crypto.randomUUID(), durationUs: sceneEnd - atUs });
    }
    cursor = sceneEnd;
  }
  return { leading, trailing };
}

function commit(state: EditorState, mutate: (project: EditorProject) => void) {
  const project = cloneProject(state.project);
  mutate(project);
  project.updatedAt = new Date().toISOString();
  project.durationUs = projectEndUs(project);
  return { project, past: [...state.past.slice(-39), state.project], future: [] };
}

function shiftForInsert(project: EditorProject, atUs: number, durationUs: number) {
  for (const track of project.tracks) {
    const additions: TimelineClip[] = [];
    for (const clip of track.clips) {
      const clipEnd = clip.startUs + clip.durationUs;
      if (clip.startUs >= atUs) {
        clip.startUs += durationUs;
      } else if (isSourceClip(clip) && clipEnd > atUs) {
        const trailingDuration = clipEnd - atUs;
        const trailing = {
          ...clip,
          id: crypto.randomUUID(),
          startUs: atUs + durationUs,
          durationUs: trailingDuration,
          sourceInUs: clip.sourceInUs + (atUs - clip.startUs) * clip.playbackRate,
          label: `${clip.label}（续）`
        } as TimelineClip;
        if (clip.kind === "video" && trailing.kind === "video") {
          const keyframes = splitVideoKeyframes(clip, atUs - clip.startUs);
          const cameraDurationUs = clip.cameraDurationUs ?? clip.durationUs;
          const cameraOffsetUs = clip.cameraOffsetUs ?? 0;
          clip.transformKeyframes = keyframes.leading;
          clip.cameraOffsetUs = cameraOffsetUs;
          clip.cameraDurationUs = cameraDurationUs;
          trailing.transformKeyframes = keyframes.trailing;
          trailing.cameraOffsetUs = cameraOffsetUs + atUs - clip.startUs;
          trailing.cameraDurationUs = cameraDurationUs;
          clip.layoutPreset = "custom";
          trailing.layoutPreset = "custom";
        }
        clip.durationUs = atUs - clip.startUs;
        additions.push(trailing);
      }
    }
    track.clips.push(...additions);
  }
}

function replaceVideoRange(project: EditorProject, startUs: number, durationUs: number) {
  const endUs = startUs + durationUs;
  const videoTracks = project.tracks.filter((track) => track.kind === "video");
  for (const track of videoTracks) {
    const next: TimelineClip[] = [];
    for (const clip of track.clips) {
      if (clip.kind !== "video") {
        next.push(clip);
        continue;
      }
      const clipEnd = clip.startUs + clip.durationUs;
      if (clipEnd <= startUs || clip.startUs >= endUs) {
        next.push(clip);
        continue;
      }
      if (clip.startUs < startUs) {
        const leading = { ...clip, durationUs: startUs - clip.startUs };
        leading.cameraOffsetUs = clip.cameraOffsetUs ?? 0;
        leading.cameraDurationUs = clip.cameraDurationUs ?? clip.durationUs;
        if (clip.transformKeyframes?.length) {
          leading.transformKeyframes = splitVideoKeyframes(clip, startUs - clip.startUs).leading;
          leading.layoutPreset = "custom";
        }
        next.push(leading);
      }
      if (clipEnd > endUs) {
        const trailingKeyframes = splitVideoKeyframes(clip, endUs - clip.startUs).trailing;
        next.push({
          ...clip,
          id: crypto.randomUUID(),
          label: `${clip.label}（续）`,
          startUs: endUs,
          durationUs: clipEnd - endUs,
          sourceInUs: clip.sourceInUs + (endUs - clip.startUs) * clip.playbackRate,
          cameraOffsetUs: (clip.cameraOffsetUs ?? 0) + endUs - clip.startUs,
          cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs,
          transformKeyframes: trailingKeyframes,
          layoutPreset: "custom"
        });
      }
    }
    track.clips = next;
  }
}

function clearSubtitleRange(project: EditorProject, startUs: number, durationUs: number) {
  const endUs = startUs + durationUs;
  const track = project.tracks.find((candidate) => candidate.kind === "subtitle");
  if (!track) return;
  track.clips = track.clips.flatMap((clip) => {
    if (clip.kind !== "subtitle" || clip.startUs >= endUs || clip.startUs + clip.durationUs <= startUs) return [clip];
    const clipEnd = clip.startUs + clip.durationUs;
    const parts: SubtitleClip[] = [];
    if (clip.startUs < startUs) parts.push({ ...clip, durationUs: startUs - clip.startUs });
    if (clipEnd > endUs) parts.push({ ...clip, id: crypto.randomUUID(), startUs: endUs, durationUs: clipEnd - endUs });
    return parts;
  });
}

function replaceGeneratedCaptions(project: EditorProject, block: GeneratedBlock) {
  const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
  track.clips = track.clips.filter((clip) => clip.kind !== "subtitle" || clip.sourceAssetId !== block.id);
  let sceneStartUs = block.startUs;
  for (const scene of block.scenes) {
    for (const cue of timedTextSegments(scene.narration, scene.durationUs)) {
      const startUs = sceneStartUs + Math.round(cue.startSeconds * 1_000_000);
      const endUs = sceneStartUs + Math.round(cue.endSeconds * 1_000_000);
      if (endUs <= startUs) continue;
      track.clips.push({
        id: crypto.randomUUID(), trackId: track.id, kind: "subtitle", label: cue.text,
        startUs, durationUs: endUs - startUs, locked: false, text: cue.text,
        sourceAssetId: block.id, sourceBlockId: block.id, color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88,
        ...DEFAULT_SUBTITLE_STYLE
      });
    }
    sceneStartUs += scene.durationUs;
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  selectedClipId: null,
  selectedClipIds: [],
  playheadUs: 0,
  zoom: 1,
  rangeStartUs: null,
  rangeEndUs: null,
  past: [],
  future: [],
  clipboard: [],
  focusPickClipId: null,
  previewRequest: null,
  setFocusPickClip: (focusPickClipId) => set({ focusPickClipId }),
  requestPreview: (startUs, endUs) => set((state) => {
    const boundedStartUs = Math.max(0, startUs);
    return { previewRequest: { id: (state.previewRequest?.id ?? 0) + 1, startUs: boundedStartUs, endUs: Math.max(boundedStartUs + 100_000, endUs) } };
  }),
  selectClip: (selectedClipId, additive = false) => set((state) => {
    if (!selectedClipId) return { selectedClipId: null, selectedClipIds: [] };
    const groupIds = expandSceneGroupClipIds(state.project, [selectedClipId]);
    if (!additive) return { selectedClipId, selectedClipIds: groupIds };
    const selectedClipIds = groupIds.every((id) => state.selectedClipIds.includes(id))
      ? state.selectedClipIds.filter((id) => !groupIds.includes(id))
      : [...new Set([...state.selectedClipIds, ...groupIds])];
    return { selectedClipIds, selectedClipId: selectedClipIds.includes(selectedClipId) ? selectedClipId : selectedClipIds.at(-1) ?? null };
  }),
  setPlayhead: (playheadUs) => set({ playheadUs: Math.max(0, playheadUs) }),
  setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.6, zoom)) }),
  setRangeStart: (timeUs) => set({ rangeStartUs: timeUs === null ? null : Math.max(0, Math.round(timeUs)) }),
  setRangeEnd: (timeUs) => set({ rangeEndUs: timeUs === null ? null : Math.max(0, Math.round(timeUs)) }),
  clearRange: () => set({ rangeStartUs: null, rangeEndUs: null }),
  updateCanvas: (canvas) => set((state) => commit(state, (project) => {
    project.canvas = {
      width: Math.max(64, Math.min(7680, Math.round(canvas.width / 2) * 2)),
      height: Math.max(64, Math.min(7680, Math.round(canvas.height / 2) * 2)),
      fpsNumerator: Math.max(1, Math.min(240_000, Math.round(canvas.fpsNumerator))),
      fpsDenominator: Math.max(1, Math.min(10_000, Math.round(canvas.fpsDenominator)))
    };
  })),
  updateMotionTheme: (patch) => set((state) => commit(state, (project) => {
    project.motionTheme = {
      ...project.motionTheme,
      ...patch,
      colors: { ...project.motionTheme.colors, ...patch.colors }
    };
  })),
  updateChapterProgress: (patch) => set((state) => commit(state, (project) => {
    project.chapterProgress = {
      ...project.chapterProgress,
      ...patch,
      backgroundOpacity: Math.max(0, Math.min(1, typeof patch.backgroundOpacity === "number" && Number.isFinite(patch.backgroundOpacity) ? patch.backgroundOpacity : project.chapterProgress.backgroundOpacity)),
      height: Math.max(28, Math.min(120, Math.round(typeof patch.height === "number" && Number.isFinite(patch.height) ? patch.height : project.chapterProgress.height))),
      chapters: (patch.chapters ?? project.chapterProgress.chapters)
        .map((chapter) => ({
          ...chapter,
          title: chapter.title.trim().slice(0, 24) || "未命名章节",
          startUs: Math.max(0, Math.round(chapter.startUs))
        }))
        .sort((left, right) => left.startUs - right.startUs)
    };
  })),
  addEffect: (effectId) => {
    const definition = effectById(effectId);
    const groupId = definition.kind === "scene" ? crypto.randomUUID() : undefined;
    const layers = definition.kind === "scene"
      ? createGeneratedEffectLayers([definition.id], definition.defaultText, definition.defaultAccentColor, definition.defaultDurationUs, "scene-template")
      : [];
    const id = layers[0]?.id ?? crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const track = project.tracks.find((candidate) => candidate.kind === "effect")!;
        const themeAccentColor = motionThemeAccentColor(project.motionTheme);
        if (definition.kind === "scene") {
          for (const layer of layers) {
            const clip: EffectClip = {
              id: layer.id, trackId: track.id, kind: "effect", label: `${definition.name} · ${effectById(layer.effectId).name}`,
              startUs: state.playheadUs + layer.startOffsetUs, durationUs: layer.durationUs, locked: false,
              effectId: layer.effectId, text: layer.text, color: layer.textColor, accentColor: themeAccentColor,
              fontSize: layer.fontSize, speed: layer.speed, transform: layer.transform, recipe: layer.recipe,
              soundCues: layer.soundCues,
              zIndex: layer.zIndex, sceneGroupId: groupId, sceneTemplateId: definition.id, matchQuery: layer.matchQuery,
              colorRole: motionColorRoleForEffect(layer.effectId),
              backdrop: { ...DEFAULT_EFFECT_BACKDROP }
            };
            track.clips.push(clip);
          }
        } else if (definition.recipe.sceneBackground) {
          const sceneTrack = project.tracks.find((candidate) => candidate.kind === "scene")!;
          const background = structuredClone(definition.recipe.sceneBackground);
          if (BUILTIN_EFFECTS.some((effect) => effect.id === definition.id)) background.borderColor = themeAccentColor;
          const clip: SceneClip = {
            id, trackId: sceneTrack.id, kind: "scene", label: definition.name, startUs: state.playheadUs,
            durationUs: definition.defaultDurationUs, locked: false, effectId,
            background, opacity: 1,
            soundCues: structuredClone(definition.soundCues ?? [])
          };
          sceneTrack.clips.push(clip);
        } else {
          const clip: EffectClip = {
            id, trackId: track.id, kind: "effect", label: definition.name, startUs: state.playheadUs,
            durationUs: definition.defaultDurationUs, locked: false, effectId, text: definition.defaultText,
            color: definition.defaultColor, accentColor: themeAccentColor,
            fontSize: recommendedEffectFontSize(definition.recipe, definition.defaultText), speed: 1,
            transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, recipe: structuredClone(definition.recipe), zIndex: 20,
            soundCues: structuredClone(definition.soundCues ?? []),
            colorRole: motionColorRoleForEffect(effectId),
            backdrop: { ...DEFAULT_EFFECT_BACKDROP }
          };
          track.clips.push(clip);
        }
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addVideo: (asset) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const hasVisualContent = project.tracks.some((track) => ["video", "image", "generated", "scene", "effect"].includes(track.kind) && track.clips.length > 0);
        if (!hasVisualContent && asset.width && asset.height) {
          project.canvas = {
            width: Math.max(64, Math.min(7680, Math.round(asset.width / 2) * 2)),
            height: Math.max(64, Math.min(7680, Math.round(asset.height / 2) * 2)),
            fpsNumerator: asset.fpsNumerator ?? project.canvas.fpsNumerator,
            fpsDenominator: asset.fpsDenominator ?? project.canvas.fpsDenominator
          };
        }
        project.assets.push(asset);
        const track = videoTrackForPlacement(project, state.playheadUs, "auto", asset.durationUs);
        track.clips.push({
          id,
          trackId: track.id,
          kind: "video",
          label: asset.name,
          startUs: state.playheadUs,
          durationUs: asset.durationUs,
          locked: false,
          assetId: asset.id,
          sourceInUs: 0,
          playbackRate: 1,
          fit: "cover",
          camera: cameraMotionForPreset("none"),
          ...videoClipFields(project, state.playheadUs)
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addImage: (asset) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        project.assets.push(asset);
        const track = project.tracks.find((candidate) => candidate.kind === "image")!;
        track.clips.push({
          id,
          trackId: track.id,
          kind: "image",
          label: asset.name,
          startUs: state.playheadUs,
          durationUs: asset.durationUs || 5_000_000,
          locked: false,
          assetId: asset.id,
          transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
          entrance: "pop",
          speed: 1
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addAudio: (asset, role = "music", startUs, sourceBlockId) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === role)
          ?? project.tracks.find((candidate) => candidate.kind === "audio")!;
        if (role === "voice" && sourceBlockId) {
          const replacedAssetIds = new Set(track.clips
            .filter((clip): clip is AudioClip => clip.kind === "audio" && clip.sourceBlockId === sourceBlockId)
            .map((clip) => clip.assetId));
          track.clips = track.clips.filter((clip) => clip.sourceBlockId !== sourceBlockId);
          const referencedAssetIds = new Set(project.tracks.flatMap((candidate) => candidate.clips).flatMap((clip) => "assetId" in clip ? [clip.assetId] : []));
          project.assets = project.assets.filter((candidate) => !replacedAssetIds.has(candidate.id) || referencedAssetIds.has(candidate.id));
        }
        const existingAsset = project.assets.find((candidate) => candidate.id === asset.id);
        if (existingAsset) Object.assign(existingAsset, asset);
        else project.assets.push(asset);
        track.clips.push({
          id,
          trackId: track.id,
          kind: "audio",
          label: asset.name,
          startUs: startUs ?? state.playheadUs,
          durationUs: asset.durationUs,
          locked: false,
          assetId: asset.id,
          sourceInUs: 0,
          playbackRate: 1,
          volume: role === "music" ? 0.65 : role === "voice" ? 1.5 : 1,
          fadeInUs: role === "music" ? 500_000 : 50_000,
          fadeOutUs: role === "music" ? 500_000 : role === "voice" ? 50_000 : 80_000,
          role,
          sourceBlockId
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addExtractedAudio: (asset, sourceVideoAssetId) => set((state) => {
    const selectedIds: string[] = [];
    const next = commit(state, (project) => {
      project.assets.push(asset);
      const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === "sound")
        ?? project.tracks.find((candidate) => candidate.kind === "audio")!;
      const sourceClips = project.tracks.flatMap((candidate) => candidate.clips).filter((clip): clip is VideoClip => clip.kind === "video" && clip.assetId === sourceVideoAssetId);
      if (!sourceClips.length) {
        const id = crypto.randomUUID();
        selectedIds.push(id);
        track.clips.push({ id, trackId: track.id, kind: "audio", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId: asset.id, sourceInUs: 0, playbackRate: 1, volume: 1, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
        return;
      }
      for (const video of sourceClips) {
        const id = crypto.randomUUID();
        selectedIds.push(id);
        track.clips.push({ id, trackId: track.id, kind: "audio", label: `${video.label} · 分离音频`, startUs: video.startUs, durationUs: video.durationUs, locked: false, assetId: asset.id, sourceInUs: video.sourceInUs, playbackRate: video.playbackRate, volume: video.volume, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
        video.volume = 0;
      }
    });
    return { ...next, selectedClipId: selectedIds[0] ?? null, selectedClipIds: selectedIds };
  }),
  placeAsset: (assetId, placement = "auto") => {
    const id = crypto.randomUUID();
    set((state) => {
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.missing) return state;
      return {
        ...commit(state, (project) => {
          if (asset.kind === "video") {
            const track = videoTrackForPlacement(project, state.playheadUs, placement, asset.durationUs);
            track.clips.push({ id, trackId: track.id, kind: "video", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId, sourceInUs: 0, playbackRate: 1, fit: "cover", camera: cameraMotionForPreset("none"), ...videoClipFields(project, state.playheadUs, placement) });
          } else if (asset.kind === "image") {
            const track = project.tracks.find((candidate) => candidate.kind === "image")!;
            track.clips.push({ id, trackId: track.id, kind: "image", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs || 5_000_000, locked: false, assetId, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1 });
          } else {
            const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === "music")!;
            track.clips.push({ id, trackId: track.id, kind: "audio", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId, sourceInUs: 0, playbackRate: 1, volume: 0.65, fadeInUs: 500_000, fadeOutUs: 500_000, role: "music" });
          }
        }),
        selectedClipId: id,
        selectedClipIds: [id]
      };
    });
  },
  updateAsset: (assetId, patch) => set((state) => commit(state, (project) => {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (asset) Object.assign(asset, patch);
  })),
  replaceProject: (project) => set({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, rangeStartUs: null, rangeEndUs: null, past: [], future: [] }),
  addGeneratedPlan: (plan, prompt, mode, target) => {
    const id = crypto.randomUUID();
    const plannedCaptions = plan.captions?.length ? plan.captions : (() => {
      let cursorSeconds = 0;
      return plan.scenes.flatMap((scene) => {
        const cues = timedTextSegments(scene.narration, Math.round(scene.durationSeconds * 1_000_000)).map((cue) => ({
          startSeconds: cursorSeconds + cue.startSeconds,
          endSeconds: cursorSeconds + cue.endSeconds,
          text: cue.text
        }));
        cursorSeconds += scene.durationSeconds;
        return cues;
      });
    })();
    const plannedDurationUs = Math.max(1_000_000, Math.round((plannedCaptions.at(-1)?.endSeconds ?? 1) * 1_000_000));
    const durationUs = Math.max(100_000, target?.durationUs ?? plannedDurationUs);
    const startUs = Math.max(0, target?.startUs ?? get().playheadUs);
    const durationScale = durationUs / plannedDurationUs;
    const captions = plannedCaptions.map((caption, index) => ({
      ...caption,
      startUs: Math.round(caption.startSeconds * 1_000_000 * durationScale),
      endUs: index === plannedCaptions.length - 1 ? durationUs : Math.round(caption.endSeconds * 1_000_000 * durationScale)
    }));
    const matchByCaption = new Map((plan.matches ?? []).map((match) => [match.captionIndex, match]));
    set((state) => ({
      ...commit(state, (project) => {
        const themeAccentColor = motionThemeAccentColor(project.motionTheme);
        if (mode === "insert") shiftForInsert(project, startUs, durationUs);
        if (mode === "replace") {
          replaceVideoRange(project, startUs, durationUs);
          clearSubtitleRange(project, startUs, durationUs);
        }
        const track = project.tracks.find((candidate) => candidate.kind === "generated")!;
        const clip: GeneratedBlock = {
          id,
          trackId: track.id,
          kind: "generated",
          label: plan.title,
          startUs,
          durationUs,
          locked: false,
          article: plan.article,
          narration: plan.narration,
          prompt,
          insertMode: mode,
          scenes: captions.map((caption, captionIndex) => {
            const match = matchByCaption.get(captionIndex);
            const definition = effectById(match?.primaryEffectId ?? "test-title-slide");
            return {
              id: crypto.randomUUID(), title: caption.text.slice(0, 80), narration: caption.text,
              durationUs: Math.max(100_000, caption.endUs - caption.startUs), effectId: definition.id,
              textColor: definition.defaultColor, accentColor: themeAccentColor,
              fontSize: recommendedEffectFontSize(definition.recipe, caption.text), speed: 1, transform: { x: match?.x ?? 50, y: match?.y ?? 30, scale: aiEffectScale(match?.scale ?? 1, Boolean(definition.recipe.chart)), rotation: 0, opacity: 1 },
              mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForPreset(match?.cameraPreset ?? "none")
            };
          })
        };
        track.clips.push(clip);

        const subtitleTrack = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
        const sceneTrack = project.tracks.find((candidate) => candidate.kind === "scene")!;
        const effectTrack = project.tracks.find((candidate) => candidate.kind === "effect")!;
        const motionCaptions = captions.map((caption) => ({
          startUs: startUs + caption.startUs,
          endUs: startUs + caption.endUs,
          text: caption.text,
          fontSize: 44,
          positionY: 88
        }));
        const motionPlacements = resolveAiMotionPlacements(
          project,
          plan.matches ?? [],
          motionCaptions,
          true,
          project.tracks
            .filter((candidate) => candidate.kind === "effect" && !candidate.hidden)
            .flatMap((candidate) => candidate.clips)
            .filter((candidate): candidate is EffectClip => candidate.kind === "effect")
        );
        captions.forEach((caption, captionIndex) => {
          const cueStartUs = startUs + caption.startUs;
          const subtitleDurationUs = Math.max(100_000, caption.endUs - caption.startUs);
          const match = matchByCaption.get(captionIndex);
          const persistUntilCaptionIndex = match?.motionGroupId
            ? Math.min(captions.length - 1, Math.max(captionIndex, match.persistUntilCaptionIndex ?? captionIndex))
            : captionIndex;
          const cueEndUs = startUs + (captions[persistUntilCaptionIndex]?.endUs ?? caption.endUs);
          const cueDurationUs = Math.max(100_000, cueEndUs - cueStartUs);
          const subtitleId = crypto.randomUUID();
          subtitleTrack.clips.push({
            id: subtitleId, trackId: subtitleTrack.id, kind: "subtitle", label: caption.text,
            startUs: cueStartUs, durationUs: subtitleDurationUs, locked: false, text: caption.text,
            sourceAssetId: id, sourceBlockId: id, color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88,
            ...DEFAULT_SUBTITLE_STYLE,
            highlightWords: subtitleKeywordsForText(caption.text, matchByCaption.get(captionIndex)?.subtitleKeywords ?? []),
            highlightColor: themeAccentColor
          });
          const effectEntries = match ? aiMotionEntries(match, caption.text, true) : [];
          for (const entry of effectEntries.slice(0, 2)) {
            if (!match) break;
            const definition = effectById(entry.effectId);
            const recipe = materializedAiEffectRecipe(entry.effectId, match);
            const placement = recipe.sceneBackground ? null : motionPlacements.get(aiMotionLayoutId(captionIndex, entry.slot));
            if (!recipe.sceneBackground && !placement) continue;
            const sceneGroupId = match?.motionGroupId ? `ai-motion:${id}:${match.motionGroupId}` : `ai-caption:${id}:${captionIndex}`;
            const soundCues = entry.zIndex === 20 ? structuredClone(definition.soundCues ?? []) : [];
            if (recipe.sceneBackground) {
              sceneTrack.clips.push({
                id: crypto.randomUUID(), trackId: sceneTrack.id, kind: "scene", label: `AI 场景 · ${definition.name}`,
                startUs: cueStartUs, durationUs: cueDurationUs, locked: false, effectId: definition.id,
                background: { ...structuredClone(recipe.sceneBackground), borderColor: themeAccentColor }, opacity: 1, soundCues, sceneGroupId, matchQuery: caption.text,
                sourceBlockId: id, sourceSubtitleId: subtitleId
              });
            } else {
              if (!placement) continue;
              effectTrack.clips.push({
                id: crypto.randomUUID(), trackId: effectTrack.id, kind: "effect", label: `AI 动效 · ${definition.name}`,
                startUs: cueStartUs, durationUs: cueDurationUs, locked: false, effectId: definition.id, text: entry.text,
                color: definition.defaultColor, accentColor: themeAccentColor,
                fontSize: recommendedEffectFontSize(recipe, entry.text), speed: 1,
                transform: { x: placement.x, y: placement.y, scale: placement.scale, rotation: 0, opacity: 1 },
                recipe, soundCues, zIndex: entry.zIndex, sceneGroupId, matchQuery: caption.text,
                colorRole: motionColorRoleForEffect(definition.id),
                sourceBlockId: id, sourceSubtitleId: subtitleId,
                backdrop: effectBackdropForPreset(match?.backdropPreset ?? "none", themeAccentColor)
              });
            }
          }
          const addVideoLayer = (layer: AiMotionMatch["videoLayers"][number], layerIndex: number) => {
            const asset = project.assets.find((candidate) => candidate.id === layer.assetId && candidate.kind === "video" && !candidate.missing);
            if (!asset || asset.durationUs <= 0) return;
            const videoTrack = videoTrackForPlacement(project, cueStartUs, "auto", cueDurationUs);
            const layout = videoLayoutForPreset(layer.layoutPreset, cueDurationUs);
            const activeZ = project.tracks.flatMap((candidate) => candidate.clips).filter((candidate): candidate is VideoClip => candidate.kind === "video" && cueStartUs < candidate.startUs + candidate.durationUs && cueStartUs + cueDurationUs > candidate.startUs).map((candidate) => candidate.zIndex ?? 0);
            const zIndex = layer.layoutPreset === "full" && activeZ.length === 0 ? 0 : Math.max(layout.zIndex, activeZ.length ? Math.max(...activeZ) + 10 : layerIndex * 10);
            videoTrack.clips.push({
              id: crypto.randomUUID(), trackId: videoTrack.id, kind: "video", label: `AI 素材 · ${asset.name}`,
              startUs: cueStartUs, durationUs: cueDurationUs, locked: false, assetId: asset.id,
              sourceBlockId: id, sourceSubtitleId: subtitleId,
              sourceInUs: Math.min(Math.round(layer.sourceInSeconds * 1_000_000), Math.max(0, asset.durationUs - 1)),
              playbackRate: 1, volume: layer.volume, fit: "cover", camera: cameraMotionForPreset(layer.cameraPreset),
              zIndex, transform: layout.transform, transformKeyframes: layout.transformKeyframes,
              layoutPreset: layer.layoutPreset, role: layer.role,
              mask: { ...DEFAULT_VIDEO_MASK, shape: layer.shapePreset },
              transition: { ...DEFAULT_VIDEO_TRANSITION, preset: layer.transitionPreset },
              focus: layer.focus ? { ...DEFAULT_VIDEO_FOCUS, enabled: layer.focus.enabled, x: layer.focus.x, y: layer.focus.y, zoom: layer.focus.zoom, startOffsetUs: Math.round(layer.focus.startOffsetSeconds * 1_000_000), durationUs: Math.min(cueDurationUs, Math.round(layer.focus.durationSeconds * 1_000_000)) } : undefined
            });
          };
          if (match) {
            const legacyLayout = mode === "overlay" ? match.mediaLayoutPreset : "full";
            matchedVideoLayers(match, legacyLayout).forEach(addVideoLayer);
          }
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
    return id;
  },
  applyMotionMatches: (subtitleIds, matches, soundAssets = []) => {
    if (!subtitleIds.length) return;
    set((state) => commit(state, (project) => {
      const themeAccentColor = motionThemeAccentColor(project.motionTheme);
      const selectedIds = new Set(subtitleIds);
      const subtitles = project.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is SubtitleClip => clip.kind === "subtitle" && selectedIds.has(clip.id))
        .sort((left, right) => left.startUs - right.startUs);
      const motionGroupSceneIds = new Map<string, string>();
      for (const match of matches) {
        if (!match.motionGroupId || motionGroupSceneIds.has(match.motionGroupId)) continue;
        const anchor = subtitles[match.captionIndex];
        if (anchor) motionGroupSceneIds.set(match.motionGroupId, `ai-motion:${match.motionGroupId}:${anchor.id}`);
      }
      const effectTrack = project.tracks.find((track) => track.kind === "effect")!;
      const sceneTrack = project.tracks.find((track) => track.kind === "scene")!;
      const soundTrack = project.tracks.find((track) => track.kind === "audio" && track.audioRole === "sound")
        ?? project.tracks.find((track) => track.kind === "audio")!;
      effectTrack.clips = effectTrack.clips.filter((clip) => clip.kind !== "effect" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
      sceneTrack.clips = sceneTrack.clips.filter((clip) => clip.kind !== "scene" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
      if (!soundTrack.locked) {
        soundTrack.clips = soundTrack.clips.filter((clip) => clip.kind !== "audio" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
        for (const asset of soundAssets) {
          const existingAsset = project.assets.find((candidate) => candidate.id === asset.id);
          if (existingAsset) Object.assign(existingAsset, asset);
          else project.assets.push(asset);
        }
      }
      for (const track of project.tracks.filter((candidate) => candidate.kind === "video")) {
        track.clips = track.clips.filter((clip) => clip.kind !== "video" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
      }
      const motionCaptions = subtitles.map((subtitle) => ({
        startUs: subtitle.startUs,
        endUs: subtitle.startUs + subtitle.durationUs,
        text: subtitle.text,
        fontSize: subtitle.fontSize,
        positionY: subtitle.positionY
      }));
      const motionPlacements = resolveAiMotionPlacements(
        project,
        matches,
        motionCaptions,
        false,
        project.tracks
          .filter((candidate) => candidate.kind === "effect" && !candidate.hidden)
          .flatMap((candidate) => candidate.clips)
          .filter((candidate): candidate is EffectClip => candidate.kind === "effect")
      );

      const addMatchedVideo = (subtitle: SubtitleClip, durationUs: number, layer: AiMotionMatch["videoLayers"][number], labelPrefix: string) => {
        const asset = project.assets.find((candidate) => candidate.id === layer.assetId && candidate.kind === "video" && !candidate.missing);
        if (!asset || asset.durationUs <= 0) return;
        const track = videoTrackForPlacement(project, subtitle.startUs, "auto", durationUs);
        const preset = layer.layoutPreset ?? "picture-in-picture-top-right";
        const layout = videoLayoutForPreset(preset, durationUs);
        const boundedSourceInUs = Math.min(Math.max(0, Math.round(layer.sourceInSeconds * 1_000_000)), Math.max(0, asset.durationUs - 1));
        const availableUs = Math.max(1, asset.durationUs - boundedSourceInUs);
        const playbackRate = Math.min(1, availableUs / durationUs);
        const activeZ = project.tracks.flatMap((candidate) => candidate.clips).filter((candidate): candidate is VideoClip => candidate.kind === "video" && subtitle.startUs < candidate.startUs + candidate.durationUs && subtitle.startUs + durationUs > candidate.startUs).map((candidate) => candidate.zIndex ?? 0);
        const zIndex = preset === "full" && activeZ.length === 0 ? 0 : Math.max(layout.zIndex, activeZ.length ? Math.max(...activeZ) + 10 : 10);
        track.clips.push({
          id: crypto.randomUUID(), trackId: track.id, kind: "video", label: `${labelPrefix} · ${asset.name}`,
          startUs: subtitle.startUs, durationUs, locked: false, assetId: asset.id,
          sourceInUs: boundedSourceInUs, playbackRate, volume: layer.volume, fit: "cover", camera: cameraMotionForPreset(layer.cameraPreset),
          zIndex, transform: layout.transform, transformKeyframes: layout.transformKeyframes,
          layoutPreset: preset, sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id,
          role: layer.role, mask: { ...DEFAULT_VIDEO_MASK, shape: layer.shapePreset },
          transition: { ...DEFAULT_VIDEO_TRANSITION, preset: layer.transitionPreset },
          focus: layer.focus ? { ...DEFAULT_VIDEO_FOCUS, enabled: layer.focus.enabled, x: layer.focus.x, y: layer.focus.y, zoom: layer.focus.zoom, startOffsetUs: Math.round(layer.focus.startOffsetSeconds * 1_000_000), durationUs: Math.min(durationUs, Math.round(layer.focus.durationSeconds * 1_000_000)) } : undefined
        });
      };

      subtitles.forEach((subtitle, captionIndex) => {
        const match = matches.find((candidate) => candidate.captionIndex === captionIndex);
        if (!match) return;
        const persistUntilCaptionIndex = match.motionGroupId
          ? Math.min(subtitles.length - 1, Math.max(captionIndex, match.persistUntilCaptionIndex ?? captionIndex))
          : captionIndex;
        const endSubtitle = subtitles[persistUntilCaptionIndex] ?? subtitle;
        const matchDurationUs = Math.max(100_000, endSubtitle.startUs + endSubtitle.durationUs - subtitle.startUs);
        subtitle.highlightWords = subtitleKeywordsForText(subtitle.text, match.subtitleKeywords ?? []);
        subtitle.highlightColor = themeAccentColor;
        const soundEffectId = match.soundEffectId;
        if (soundEffectId && !soundTrack.locked) {
          const definition = builtinSoundEffectById(soundEffectId);
          const asset = project.assets.find((candidate) => candidate.id === builtinSoundAssetId(soundEffectId) && candidate.kind === "audio" && !candidate.missing);
          if (definition && asset) {
            soundTrack.clips.push({
              id: crypto.randomUUID(), trackId: soundTrack.id, kind: "audio", label: `AI 音效 · ${definition.name}`,
              startUs: subtitle.startUs, durationUs: asset.durationUs, locked: false, assetId: asset.id,
              sourceInUs: 0, playbackRate: 1, volume: 1, fadeInUs: 0, fadeOutUs: Math.min(50_000, asset.durationUs), role: "sound",
              sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id
            });
          }
        }
        const entries = aiMotionEntries(match, subtitle.text, false);
        for (const entry of entries.slice(0, 2)) {
          const definition = effectById(entry.effectId);
          const recipe = materializedAiEffectRecipe(entry.effectId, match);
          const placement = recipe.sceneBackground ? null : motionPlacements.get(aiMotionLayoutId(captionIndex, entry.slot));
          if (!recipe.sceneBackground && !placement) continue;
          const sceneGroupId = match.motionGroupId ? motionGroupSceneIds.get(match.motionGroupId) : `ai-subtitle:${subtitle.id}`;
          const soundCues = entry.zIndex === 20 ? structuredClone(definition.soundCues ?? []) : [];
          if (recipe.sceneBackground) {
            sceneTrack.clips.push({
              id: crypto.randomUUID(), trackId: sceneTrack.id, kind: "scene", label: `AI 场景 · ${definition.name}`,
              startUs: subtitle.startUs, durationUs: matchDurationUs, locked: false, effectId: definition.id,
              background: { ...structuredClone(recipe.sceneBackground), borderColor: themeAccentColor }, opacity: 1, soundCues, sceneGroupId, matchQuery: subtitle.text,
              sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id
            });
          } else {
            if (!placement) continue;
            effectTrack.clips.push({
              id: crypto.randomUUID(), trackId: effectTrack.id, kind: "effect", label: `AI 动效 · ${definition.name}`,
              startUs: subtitle.startUs, durationUs: matchDurationUs, locked: false, effectId: definition.id, text: entry.text.trim(),
              color: definition.defaultColor, accentColor: themeAccentColor,
              fontSize: recommendedEffectFontSize(recipe, entry.text.trim()), speed: 1,
              transform: { x: placement.x, y: placement.y, scale: placement.scale, rotation: 0, opacity: 1 }, recipe,
              soundCues, zIndex: entry.zIndex, sceneGroupId, matchQuery: subtitle.text,
              colorRole: motionColorRoleForEffect(definition.id),
              sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id,
              backdrop: effectBackdropForPreset(match.backdropPreset ?? "none", themeAccentColor)
            });
          }
        }

        if (match.cameraPreset !== "none" && subtitle.sourceAssetId) {
          const sourceVideo = project.tracks.flatMap((track) => track.clips).find((clip): clip is VideoClip => (
            clip.kind === "video" && clip.assetId === subtitle.sourceAssetId && !clip.sourceSubtitleId
            && clip.startUs <= subtitle.startUs && clip.startUs + clip.durationUs >= subtitle.startUs + matchDurationUs
          ));
          if (sourceVideo) {
            const sourceInUs = sourceVideo.sourceInUs + Math.round((subtitle.startUs - sourceVideo.startUs) * sourceVideo.playbackRate);
            addMatchedVideo(subtitle, matchDurationUs, { assetId: sourceVideo.assetId, role: sourceVideo.role ?? "a-roll", sourceInSeconds: sourceInUs / 1_000_000, layoutPreset: "full", shapePreset: sourceVideo.mask?.shape ?? "rectangle", transitionPreset: "none", cameraPreset: match.cameraPreset, volume: 0, focus: null }, "AI 运镜");
          }
        }
        matchedVideoLayers(match).forEach((layer) => addMatchedVideo(subtitle, matchDurationUs, layer, "AI 素材"));
      });
    }));
  },
  alignGeneratedBlockDuration: (blockId, durationUs) => {
    const nextDurationUs = Math.max(100_000, Math.round(durationUs));
    set((state) => commit(state, (project) => {
      const block = findClip(project, blockId);
      if (!block || block.kind !== "generated" || block.durationUs === nextDurationUs) return;
      const previousDurationUs = block.durationUs;
      const previousEndUs = block.startUs + previousDurationUs;
      const ratio = nextDurationUs / previousDurationUs;
      const deltaUs = nextDurationUs - previousDurationUs;
      const related = (clip: TimelineClip) => clip.id === blockId
        || clip.sourceBlockId === blockId
        || (clip.kind === "subtitle" && clip.sourceAssetId === blockId)
        || ((clip.kind === "scene" || clip.kind === "effect") && clip.sceneGroupId?.startsWith(`ai-caption:${blockId}:`));
      if (block.insertMode === "insert" && deltaUs !== 0) {
        for (const clip of project.tracks.flatMap((track) => track.clips)) {
          if (!related(clip) && clip.startUs >= previousEndUs) clip.startUs += deltaUs;
        }
      }
      for (const clip of project.tracks.flatMap((track) => track.clips)) {
        if (!related(clip) || clip.id === blockId) continue;
        clip.startUs = block.startUs + Math.round((clip.startUs - block.startUs) * ratio);
        clip.durationUs = Math.max(100_000, Math.round(clip.durationUs * ratio));
        if (clip.kind === "video") clip.playbackRate /= ratio;
        if ((clip.kind === "video" || clip.kind === "effect") && clip.transformKeyframes?.length) {
          clip.transformKeyframes = clip.transformKeyframes.map((frame) => ({ ...frame, offsetUs: Math.round(frame.offsetUs * ratio) }));
        }
      }
      block.durationUs = nextDurationUs;
      block.scenes = block.scenes.map((scene) => ({
        ...scene,
        durationUs: Math.max(100_000, Math.round(scene.durationUs * ratio)),
        additionalEffects: scene.additionalEffects?.map((layer) => ({
          ...layer,
          startOffsetUs: Math.round(layer.startOffsetUs * ratio),
          durationUs: Math.max(100_000, Math.round(layer.durationUs * ratio))
        }))
      }));
      const sceneTotal = block.scenes.reduce((sum, scene) => sum + scene.durationUs, 0);
      if (block.scenes.length && sceneTotal !== nextDurationUs) block.scenes[block.scenes.length - 1].durationUs += nextDurationUs - sceneTotal;
    }));
  },
  alignGeneratedSceneDurations: (blockId, durationsUs, subtitleIds) => {
    const normalized = durationsUs.map((durationUs) => Math.max(100_000, Math.round(durationUs)));
    set((state) => commit(state, (project) => {
      const block = findClip(project, blockId);
      if (!block || block.kind !== "generated" || normalized.length !== block.scenes.length || !normalized.length) return;
      const orderedSubtitles = project.tracks
        .flatMap((track) => track.clips)
        .filter((clip): clip is SubtitleClip => clip.kind === "subtitle" && clip.sourceBlockId === blockId)
        .sort((left, right) => left.startUs - right.startUs);
      const subtitleById = new Map(orderedSubtitles.map((subtitle) => [subtitle.id, subtitle]));
      const subtitles = subtitleIds?.length
        ? subtitleIds.flatMap((subtitleId) => subtitleById.get(subtitleId) ?? [])
        : orderedSubtitles;
      if (subtitles.length !== normalized.length) return;

      const previousEndUs = block.startUs + block.durationUs;
      const nextDurationUs = normalized.reduce((sum, durationUs) => sum + durationUs, 0);
      const deltaUs = nextDurationUs - block.durationUs;
      if (block.insertMode === "insert" && deltaUs !== 0) {
        for (const clip of project.tracks.flatMap((track) => track.clips)) {
          const related = clip.id === blockId || clip.sourceBlockId === blockId;
          if (!related && clip.startUs >= previousEndUs) clip.startUs += deltaUs;
        }
      }

      let cursorUs = block.startUs;
      const spans = subtitles.map((subtitle, index) => {
        const nextStartUs = cursorUs;
        cursorUs += normalized[index];
        return {
          previousStartUs: subtitle.startUs,
          previousEndUs: subtitle.startUs + subtitle.durationUs,
          nextStartUs,
          nextEndUs: cursorUs
        };
      });
      const retimeUs = (timeUs: number) => {
        const first = spans[0];
        const last = spans[spans.length - 1];
        if (timeUs <= first.previousStartUs) return first.nextStartUs + timeUs - first.previousStartUs;
        for (const span of spans) {
          if (timeUs > span.previousEndUs) continue;
          const progress = (timeUs - span.previousStartUs) / Math.max(1, span.previousEndUs - span.previousStartUs);
          return span.nextStartUs + Math.round((span.nextEndUs - span.nextStartUs) * Math.max(0, Math.min(1, progress)));
        }
        return last.nextEndUs + timeUs - last.previousEndUs;
      };
      for (const clip of project.tracks.flatMap((track) => track.clips)) {
        if (clip.id === blockId || clip.kind === "subtitle" || clip.sourceBlockId !== blockId) continue;
        if (clip.kind === "audio" && clip.role === "voice") {
          clip.startUs = block.startUs;
          clip.durationUs = nextDurationUs;
          clip.sourceInUs = 0;
          clip.playbackRate = 1;
          continue;
        }
        const previousStartUs = clip.startUs;
        const previousDurationUs = Math.max(1, clip.durationUs);
        const nextStartUs = retimeUs(previousStartUs);
        const nextEndUs = retimeUs(previousStartUs + clip.durationUs);
        const nextClipDurationUs = Math.max(100_000, nextEndUs - nextStartUs);
        const ratio = nextClipDurationUs / previousDurationUs;
        clip.startUs = nextStartUs;
        clip.durationUs = nextClipDurationUs;
        if (clip.kind === "video") clip.playbackRate /= ratio;
        if ((clip.kind === "video" || clip.kind === "effect") && clip.transformKeyframes?.length) {
          clip.transformKeyframes = clip.transformKeyframes.map((frame) => ({ ...frame, offsetUs: Math.round(frame.offsetUs * ratio) }));
        }
        if (clip.kind === "video" && clip.presentationCues?.length) {
          clip.presentationCues = clip.presentationCues.map((cue) => ({
            ...cue,
            offsetUs: Math.round(cue.offsetUs * ratio),
            transitionDurationUs: cue.transitionDurationUs <= 0 ? 0 : Math.max(100_000, Math.round(cue.transitionDurationUs * ratio)),
            focus: {
              ...cue.focus,
              startOffsetUs: Math.round(cue.focus.startOffsetUs * ratio),
              durationUs: Math.max(100_000, Math.round(cue.focus.durationUs * ratio))
            }
          }));
        }
      }
      subtitles.forEach((subtitle, index) => {
        subtitle.startUs = spans[index].nextStartUs;
        subtitle.durationUs = normalized[index];
        const previousSceneDurationUs = Math.max(1, block.scenes[index].durationUs);
        const ratio = normalized[index] / previousSceneDurationUs;
        block.scenes[index].durationUs = normalized[index];
        block.scenes[index].additionalEffects = block.scenes[index].additionalEffects?.map((layer) => ({
          ...layer,
          startOffsetUs: Math.round(layer.startOffsetUs * ratio),
          durationUs: Math.max(100_000, Math.round(layer.durationUs * ratio))
        }));
      });
      block.durationUs = nextDurationUs;
    }));
  },
  updateEffect: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "effect") return;
    Object.assign(clip, patch);
  })),
  updateScene: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "scene") return;
    Object.assign(clip, patch);
  })),
  updateVideo: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "video") return;
    Object.assign(clip, patch);
  })),
  addVideoPresentationCue: (clipId, presetId, offsetUs) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "video" || clip.locked) return;
    const cue = createVideoPresentationCue(presetId, clip, offsetUs);
    const cues = [...(clip.presentationCues ?? [])];
    const existing = cues.findIndex((candidate) => Math.abs(candidate.offsetUs - cue.offsetUs) <= 20_000);
    if (existing >= 0) cues[existing] = { ...cue, id: cues[existing].id };
    else cues.push(cue);
    clip.presentationCues = cues.sort((left, right) => left.offsetUs - right.offsetUs);
  })),
  updateVideoPresentationCue: (clipId, cueId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "video" || clip.locked) return;
    const cue = clip.presentationCues?.find((candidate) => candidate.id === cueId);
    if (!cue) return;
    Object.assign(cue, patch);
    cue.offsetUs = Math.max(0, Math.min(clip.durationUs - 1, Math.round(cue.offsetUs)));
    cue.transitionDurationUs = cue.transitionDurationUs <= 0
      ? 0
      : Math.max(100_000, Math.min(clip.durationUs - cue.offsetUs, Math.round(cue.transitionDurationUs)));
    cue.focus = {
      ...cue.focus,
      startOffsetUs: cue.offsetUs,
      durationUs: Math.max(100_000, Math.min(clip.durationUs - cue.offsetUs, Math.round(cue.focus.durationUs)))
    };
    clip.presentationCues?.sort((left, right) => left.offsetUs - right.offsetUs);
  })),
  removeVideoPresentationCue: (clipId, cueId) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "video" || clip.locked) return;
    clip.presentationCues = (clip.presentationCues ?? []).filter((cue) => cue.id !== cueId);
  })),
  updateImage: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "image") return;
    Object.assign(clip, patch);
  })),
  updateAudio: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "audio") return;
    Object.assign(clip, patch);
  })),
  updateGenerated: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "generated") return;
    Object.assign(clip, patch);
  })),
  updateGeneratedScene: (clipId, sceneId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "generated") return;
    const scene = clip.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return;
    Object.assign(scene, patch);
    scene.additionalEffects = (scene.additionalEffects ?? []).map((layer) => {
      const startOffsetUs = Math.min(Math.max(0, layer.startOffsetUs), Math.max(0, scene.durationUs - 100_000));
      return {
        ...layer,
        startOffsetUs,
        durationUs: Math.min(Math.max(100_000, layer.durationUs), Math.max(100_000, scene.durationUs - startOffsetUs))
      };
    });
    clip.durationUs = Math.max(1_000_000, clip.scenes.reduce((sum, candidate) => sum + candidate.durationUs, 0));
    replaceGeneratedCaptions(project, clip);
  })),
  addSubtitles: (assetId, segments) => set((state) => commit(state, (project) => {
    const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
    const videoClips = project.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video" && clip.assetId === assetId && !clip.sourceSubtitleId);
    const replacedSubtitleIds = new Set(subtitleTrack.clips.filter((clip) => clip.kind === "subtitle" && clip.sourceAssetId === assetId).map((clip) => clip.id));
    subtitleTrack.clips = subtitleTrack.clips.filter((clip) => clip.kind !== "subtitle" || clip.sourceAssetId !== assetId);
    for (const track of project.tracks) track.clips = track.clips.filter((clip) => !clip.sourceSubtitleId || !replacedSubtitleIds.has(clip.sourceSubtitleId));
    for (const video of videoClips) {
      const sourceStart = video.sourceInUs;
      const sourceEnd = sourceStart + video.durationUs * video.playbackRate;
      for (const segment of segments) {
        const cueStart = Math.round(segment.startSeconds * 1_000_000);
        const cueEnd = Math.round(segment.endSeconds * 1_000_000);
        const overlapStart = Math.max(sourceStart, cueStart);
        const overlapEnd = Math.min(sourceEnd, cueEnd);
        if (overlapEnd <= overlapStart || !segment.text.trim()) continue;
        const clip: SubtitleClip = {
          id: crypto.randomUUID(), trackId: subtitleTrack.id, kind: "subtitle", label: segment.text.trim(),
          startUs: Math.round(video.startUs + (overlapStart - sourceStart) / video.playbackRate),
          durationUs: Math.max(100_000, Math.round((overlapEnd - overlapStart) / video.playbackRate)),
          locked: false, text: segment.text.trim(), sourceAssetId: assetId, color: "#ffffff",
          backgroundColor: "#000000", fontSize: 44, positionY: 88,
          ...DEFAULT_SUBTITLE_STYLE
        };
        subtitleTrack.clips.push(clip);
      }
    }
  })),
  updateSubtitle: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "subtitle") return;
    Object.assign(clip, patch);
  })),
  updateSubtitleAppearance: (clipId, patch) => set((state) => commit(state, (project) => {
    for (const track of project.tracks) {
      if (track.kind !== "subtitle" || track.locked) continue;
      for (const clip of track.clips) {
        if (clip.kind !== "subtitle" || clip.locked || (clipId !== null && clip.id !== clipId)) continue;
        Object.assign(clip, patch);
      }
    }
  })),
  moveClips: (clipIds, deltaUs) => {
    if (!clipIds.length || Math.abs(deltaUs) < 1) return;
    set((state) => commit(state, (project) => {
      const selected = new Set(expandSceneGroupClipIds(project, clipIds));
      const clips = project.tracks.flatMap((track) => track.locked ? [] : track.clips).filter((clip) => selected.has(clip.id) && !clip.locked);
      const minimumStart = clips.reduce((minimum, clip) => Math.min(minimum, clip.startUs), Number.POSITIVE_INFINITY);
      const boundedDelta = Math.max(deltaUs, -minimumStart);
      for (const clip of clips) clip.startUs = Math.round(clip.startUs + boundedDelta);
    }));
  },
  trimClip: (clipId, edge, deltaUs) => {
    if (Math.abs(deltaUs) < 1) return;
    set((state) => commit(state, (project) => {
      const clip = findClip(project, clipId);
      const track = clip ? project.tracks.find((candidate) => candidate.id === clip.trackId) : undefined;
      if (!clip || clip.locked || track?.locked) return;
      if ((clip.kind === "effect" || clip.kind === "scene") && stretchSceneGroup(project, clip, edge, deltaUs)) return;
      const minimumDuration = clip.kind === "subtitle" ? 100_000 : 250_000;
      if (edge === "start") {
        const actualDelta = Math.min(deltaUs, clip.durationUs - minimumDuration);
        const sourceLimit = isSourceClip(clip) ? -clip.sourceInUs / clip.playbackRate : -clip.startUs;
        const boundedDelta = Math.max(actualDelta, -clip.startUs, sourceLimit);
        const presentationBoundary = clip.kind === "video" && boundedDelta > 0 ? videoPresentationAt(clip, boundedDelta) : undefined;
        clip.startUs += boundedDelta;
        clip.durationUs -= boundedDelta;
        if (isSourceClip(clip)) clip.sourceInUs = Math.max(0, Math.round(clip.sourceInUs + boundedDelta * clip.playbackRate));
        if (clip.kind === "video") {
          clip.cameraOffsetUs = Math.max(0, (clip.cameraOffsetUs ?? 0) + boundedDelta);
          clip.cameraDurationUs = clip.cameraDurationUs ?? clip.durationUs + boundedDelta;
          const boundary = visualTransformAt(clip.transform ?? DEFAULT_TRANSFORM, clip.transformKeyframes, Math.max(0, boundedDelta));
          clip.transformKeyframes = [{ offsetUs: 0, x: boundary.x, y: boundary.y, scale: boundary.scale, easing: "ease-in-out" }, ...(clip.transformKeyframes ?? []).filter((frame) => frame.offsetUs > boundedDelta).map((frame) => ({ ...frame, offsetUs: Math.max(0, frame.offsetUs - boundedDelta) }))];
          if (presentationBoundary) {
            clip.transform = presentationBoundary.transform;
            clip.transformKeyframes = [];
            clip.mask = presentationBoundary.mask;
            clip.focus = presentationBoundary.focus;
            clip.camera = presentationBoundary.camera;
            clip.fit = presentationBoundary.fit;
          }
          clip.presentationCues = (clip.presentationCues ?? [])
            .filter((cue) => boundedDelta <= 0 || cue.offsetUs > boundedDelta)
            .map((cue) => {
              const offsetUs = Math.max(0, cue.offsetUs - boundedDelta);
              return { ...cue, offsetUs, focus: { ...cue.focus, startOffsetUs: offsetUs } };
            });
        }
        if (clip.kind === "generated") trimGeneratedStart(clip, boundedDelta);
      } else {
        let durationUs = Math.max(minimumDuration, Math.round(clip.durationUs + deltaUs));
        if (isSourceClip(clip)) {
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          if (asset) durationUs = Math.min(durationUs, Math.max(minimumDuration, (asset.durationUs - clip.sourceInUs) / clip.playbackRate));
        }
        clip.durationUs = durationUs;
        if (clip.kind === "video") {
          clip.transformKeyframes = (clip.transformKeyframes ?? []).filter((frame) => frame.offsetUs <= durationUs);
          clip.presentationCues = (clip.presentationCues ?? []).filter((cue) => cue.offsetUs < durationUs).map((cue) => ({ ...cue, transitionDurationUs: Math.min(cue.transitionDurationUs, durationUs - cue.offsetUs) }));
        }
        if (clip.kind === "generated") trimGeneratedEnd(clip, durationUs);
      }
    }));
  },
  splitSelected: () => {
    const { selectedClipIds, playheadUs } = get();
    if (!selectedClipIds.length) return;
    const created: string[] = [];
    set((state) => ({
      ...commit(state, (project) => {
        for (const track of project.tracks) {
          if (track.locked) continue;
          const additions: TimelineClip[] = [];
          for (const clip of track.clips) {
            if (!selectedClipIds.includes(clip.id) || clip.locked || playheadUs <= clip.startUs || playheadUs >= clip.startUs + clip.durationUs) continue;
            const firstDuration = playheadUs - clip.startUs;
            const trailing = structuredClone(clip);
            trailing.id = crypto.randomUUID();
            trailing.label = `${clip.label}（后段）`;
            trailing.startUs = playheadUs;
            trailing.durationUs = clip.durationUs - firstDuration;
            if (isSourceClip(trailing)) trailing.sourceInUs = Math.round(trailing.sourceInUs + firstDuration * trailing.playbackRate);
            if (clip.kind === "video" && trailing.kind === "video") {
              const trailingPresentation = videoPresentationAt(clip, firstDuration);
              const keyframes = splitVideoKeyframes(clip, firstDuration);
              const cameraDurationUs = clip.cameraDurationUs ?? clip.durationUs;
              const cameraOffsetUs = clip.cameraOffsetUs ?? 0;
              clip.transformKeyframes = keyframes.leading;
              clip.cameraOffsetUs = cameraOffsetUs;
              clip.cameraDurationUs = cameraDurationUs;
              trailing.transformKeyframes = keyframes.trailing;
              trailing.cameraOffsetUs = cameraOffsetUs + firstDuration;
              trailing.cameraDurationUs = cameraDurationUs;
              clip.layoutPreset = "custom";
              trailing.layoutPreset = "custom";
              clip.presentationCues = (clip.presentationCues ?? []).filter((cue) => cue.offsetUs < firstDuration);
              trailing.presentationCues = (trailing.presentationCues ?? []).filter((cue) => cue.offsetUs >= firstDuration).map((cue) => {
                const offsetUs = cue.offsetUs - firstDuration;
                return { ...cue, offsetUs, focus: { ...cue.focus, startOffsetUs: offsetUs } };
              });
              trailing.transform = trailingPresentation.transform;
              trailing.transformKeyframes = [];
              trailing.mask = trailingPresentation.mask;
              trailing.focus = trailingPresentation.focus;
              trailing.camera = trailingPresentation.camera;
              trailing.fit = trailingPresentation.fit;
            }
            if (clip.kind === "generated" && trailing.kind === "generated") {
              const scenes = splitGeneratedScenes(clip, firstDuration);
              clip.scenes = scenes.leading;
              trailing.scenes = scenes.trailing;
            }
            clip.durationUs = firstDuration;
            additions.push(trailing);
            created.push(trailing.id);
          }
          track.clips.push(...additions);
        }
      }),
      selectedClipId: created.at(-1) ?? state.selectedClipId,
      selectedClipIds: created.length ? created : state.selectedClipIds
    }));
  },
  copySelected: () => set((state) => ({ clipboard: state.project.tracks.flatMap((track) => track.clips).filter((clip) => state.selectedClipIds.includes(clip.id)).map((clip) => structuredClone(clip)) })),
  pasteAtPlayhead: () => {
    const clipboard = get().clipboard;
    if (!clipboard.length) return;
    const minimumStart = Math.min(...clipboard.map((clip) => clip.startUs));
    const created: string[] = [];
    set((state) => ({
      ...commit(state, (project) => {
        for (const source of clipboard) {
          const track = project.tracks.find((candidate) => candidate.id === source.trackId && !candidate.locked);
          if (!track) continue;
          const clip = structuredClone(source);
          clip.id = crypto.randomUUID();
          clip.startUs = Math.round(state.playheadUs + source.startUs - minimumStart);
          clip.locked = false;
          if (clip.kind === "generated") clip.scenes = clip.scenes.map((scene) => ({ ...scene, id: crypto.randomUUID() }));
          track.clips.push(clip);
          created.push(clip.id);
        }
      }),
      selectedClipId: created.at(-1) ?? null,
      selectedClipIds: created
    }));
  },
  setTrackState: (trackId, patch) => set((state) => commit(state, (project) => {
    const track = project.tracks.find((candidate) => candidate.id === trackId);
    if (track) Object.assign(track, patch);
  })),
  removeSelected: () => {
    const selected = new Set(get().selectedClipIds);
    if (!selected.size) return;
    set((state) => ({
      ...commit(state, (project) => {
        for (const track of project.tracks) if (!track.locked) track.clips = track.clips.filter((clip) => clip.locked || (!selected.has(clip.id) && !(clip.kind === "subtitle" && clip.sourceAssetId && selected.has(clip.sourceAssetId))));
      }),
      selectedClipId: null,
      selectedClipIds: []
    }));
  },
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future], selectedClipId: null, selectedClipIds: [] };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return { project: next, past: [...state.past, state.project], future: state.future.slice(1), selectedClipId: null, selectedClipIds: [] };
  })
}));

export function selectedClip(project: EditorProject, selectedClipId: string | null) {
  return findClip(project, selectedClipId);
}
