import { defaultShotcraftSettings, isShotcraftComposition, normalizeShotcraftSettings, shotcraftHoldPatch } from "@/domain/shotcraft";
import { appendShotcraftSequence, type ShotcraftPlan, type ShotcraftSequenceOptions } from "@/domain/shotcraftPlan";
import { create } from "zustand";
import { compositionLayer, mediaComposition, normalizeBindings, compositionBindingIssues, compositionSlots, compositionTimeUs, compositionRetimeBounds, sceneGroupRetimeRatio, slotAccepts, isBackgroundComposition, isSequencedMediaComposition, type CompositionBinding } from "@/domain/compositions";
import { DEFAULT_VIDEO_LAYER, normalizeLayer } from "@/domain/layers";
import { normalizeVideoMask } from "@/domain/videoFrame";
import { normalizePresenterSafeArea } from "@/domain/presenterSafeArea";
import { normalizeSubtitleTheme } from "@/domain/subtitleTheme";
import { BUILTIN_EFFECTS, OVERLAY_STUDIO_EFFECT_IDS, compositionById, defaultEffectTransform, effectParamsForText, recommendedEffectFontSizeForId } from "@/domain/effects";
import { cameraMotionForPreset } from "@/domain/camera";
import { timedTextSegments } from "@/domain/captions";
import { createGeneratedEffectLayers } from "@/domain/sceneEffects";
import { sceneBackgroundComposition } from "@/domain/sceneBackground";
import { presenterMotionSafeArea, resolveMotionLayout, type MotionLayoutLayer, type OccupiedMotionLayoutLayer } from "@/domain/motionLayout";
import { motionColorRoleForEffect, motionThemeAccentColor } from "@/domain/motionTheme";
import { compileAiMotionParams, type MotionParamOverride } from "@/domain/motionMatching";
import { isReferenceStageComposition, referenceStageOuterTransform } from "@/domain/overlayStudioReference";
import { DEFAULT_TRANSFORM, videoLayoutForPreset, visualTransformAt } from "@/domain/transforms";
import {
  createEmptyProject,
  projectEndUs,
  type AudioClip,
  type AudioRole,
  type ChapterProgressSettings,
  type EditorProject,
  type CompositionClip,
  type GeneratedBlock,
  type ImageClip,
  type InsertMode,
  type MediaAsset,
  type MotionTheme,
  type PresenterSafeAreaSettings,
  type SceneClip,
  type SubtitleClip,
  type TimelineClip,
  type TimelineTrack,
  type VideoClip,
  type VideoMotionPresetId,
  type VideoPresentationCue,
  type VideoTransition
} from "@/domain/project";
import type { AiMotionMatch, AiSoundMatch, AiVideoPlan } from "@/services/ai/schema";
import { createVideoPresentationCue, DEFAULT_EFFECT_BACKDROP, DEFAULT_VIDEO_FOCUS, DEFAULT_VIDEO_MASK, DEFAULT_VIDEO_TRANSITION, selectedVisualTransitionCuts, videoPresentationAt } from "@/domain/videoPresentation";
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

export interface MotionMatchApplySummary {
  requestedEffectCount: number;
  effectCount: number;
  sceneCount: number;
  soundCount: number;
  videoCount: number;
  skippedEffectCount: number;
}

function aiEffectScale(compositionId: string, matchScale: number, hasChart: boolean) {
  if (OVERLAY_STUDIO_EFFECT_IDS.includes(compositionId as (typeof OVERLAY_STUDIO_EFFECT_IDS)[number])) return 1;
  return Math.max(hasChart ? 0.8 : 0.65, Math.min(2.5, matchScale));
}

function effectMotionLayoutLayer(effect: CompositionClip): MotionLayoutLayer {
  return {
    id: effect.id,
    compositionId: effect.compositionId,
    startUs: effect.startUs,
    durationUs: effect.durationUs,
    desiredX: effect.transform.x,
    desiredY: effect.transform.y,
    scale: effect.transform.scale,
    fontSize: effect.fontSize,
    text: effect.text,
    recipe: effect.recipe ?? compositionById(effect.compositionId).recipe,
    priority: "primary"
  };
}

function occupiedMotionLayoutLayer(effect: CompositionClip): OccupiedMotionLayoutLayer {
  return {
    layer: effectMotionLayoutLayer(effect),
    placement: { x: effect.transform.x, y: effect.transform.y, scale: effect.transform.scale }
  };
}

function placeNewEffect(project: EditorProject, effect: CompositionClip) {
  if (isReferenceStageComposition(effect.compositionId)) {
    effect.transform = referenceStageOuterTransform(effect.transform);
    return;
  }
  const safeArea = presenterMotionSafeArea(project.presenterSafeArea, effect.startUs, effect.durationUs);
  const occupiedLayers = project.tracks
    .flatMap((track) => track.clips)
    .filter((clip): clip is CompositionClip => clip.kind === "composition")
    .map(occupiedMotionLayoutLayer);
  const placement = resolveMotionLayout({
    canvas: project.canvas,
    layers: [effectMotionLayoutLayer(effect)],
    safeAreas: safeArea ? [safeArea] : [],
    occupiedLayers
  }).get(effect.id);
  if (placement) effect.transform = { ...effect.transform, ...placement };
}

type AiMotionEntrySlot = "primary" | "secondary";

interface AiMotionEntry {
  slot: AiMotionEntrySlot;
  compositionId: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  params: readonly MotionParamOverride[];
  timingCaptionIndices: readonly number[];
  materialPlaceholder: boolean;
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
  const primaryDefinition = match.primaryEffectId ? compositionById(match.primaryEffectId) : null;
  const primaryText = primaryDefinition?.recipe.sceneBackground
    ? ""
    : match.primaryText.trim() || (useCaptionFallback ? captionText : "");
  const entries: Array<AiMotionEntry | null> = [
    primaryDefinition && (primaryText || primaryDefinition.recipe.sceneBackground || isBackgroundComposition(primaryDefinition.id) || compositionSlots(primaryDefinition.id).length > 0)
      ? { slot: "primary", compositionId: primaryDefinition.id, text: primaryText, x: match.x, y: match.y, scale: match.scale, zIndex: 20, params: match.primaryParams ?? [], timingCaptionIndices: match.primaryTimingCaptionIndices ?? [], materialPlaceholder: match.materialPlaceholder ?? false }
      : null,
    match.secondaryEffectId && match.secondaryText?.trim()
      ? { slot: "secondary", compositionId: match.secondaryEffectId, text: match.secondaryText.trim(), x: match.secondaryX, y: match.secondaryY, scale: Math.min(1.5, match.scale), zIndex: 30, params: match.secondaryParams ?? [], timingCaptionIndices: match.secondaryTimingCaptionIndices ?? [], materialPlaceholder: false }
      : null
  ];
  return entries.filter((entry): entry is AiMotionEntry => Boolean(entry));
}

function materializedAiEffectRecipe(compositionId: string, match: AiMotionMatch) {
  const recipe = structuredClone(compositionById(compositionId).recipe);
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
  existingEffects: readonly CompositionClip[]
) {
  const matchByCaption = new Map(matches.map((match) => [match.captionIndex, match]));
  const layers: MotionLayoutLayer[] = [];
  const referencePlacements = new Map<string, { x: number; y: number; scale: number }>();
  for (let captionIndex = 0; captionIndex < captions.length; captionIndex += 1) {
    const match = matchByCaption.get(captionIndex);
    const caption = captions[captionIndex];
    if (!match || !caption) continue;
    const persistUntilCaptionIndex = match.motionGroupId
      ? Math.min(captions.length - 1, Math.max(captionIndex, match.persistUntilCaptionIndex ?? captionIndex))
      : captionIndex;
    const endUs = captions[persistUntilCaptionIndex]?.endUs ?? caption.endUs;
    for (const entry of aiMotionEntries(match, caption.text, useCaptionFallback)) {
      const recipe = materializedAiEffectRecipe(entry.compositionId, match);
      if (recipe.sceneBackground || isBackgroundComposition(entry.compositionId) || mediaComposition(entry.compositionId)) continue;
      if (isReferenceStageComposition(entry.compositionId)) {
        referencePlacements.set(aiMotionLayoutId(captionIndex, entry.slot), { x: 50, y: 50, scale: 1 });
        continue;
      }
      layers.push({
        id: aiMotionLayoutId(captionIndex, entry.slot),
        compositionId: entry.compositionId,
        startUs: caption.startUs,
        durationUs: Math.max(100_000, endUs - caption.startUs),
        desiredX: entry.x,
        desiredY: entry.y,
        scale: aiEffectScale(entry.compositionId, entry.scale, Boolean(recipe.chart)),
        fontSize: recommendedEffectFontSizeForId(entry.compositionId, recipe, entry.text),
        text: entry.text,
        recipe,
        priority: entry.slot
      });
    }
  }
  const occupiedLayers = existingEffects.filter((effect) => !isReferenceStageComposition(effect.compositionId)).map(occupiedMotionLayoutLayer);
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
  if (captions.length) {
    const firstStartUs = Math.min(...captions.map((caption) => caption.startUs));
    const lastEndUs = Math.max(...captions.map((caption) => caption.endUs));
    const presenterArea = presenterMotionSafeArea(project.presenterSafeArea, firstStartUs, lastEndUs - firstStartUs);
    if (presenterArea) safeAreas.push(presenterArea);
  }
  const placements = resolveMotionLayout({ canvas: project.canvas, layers, safeAreas, occupiedLayers });
  for (const [id, placement] of referencePlacements) placements.set(id, placement);
  return placements;
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
  selectSceneGroup: (groupId: string) => void;
  retimeSceneGroup: (groupId: string, durationUs: number) => void;
  retimeComposition: (clipId: string, durationUs: number) => void;
  setPlayhead: (timeUs: number) => void;
  setZoom: (zoom: number) => void;
  setRangeStart: (timeUs: number | null) => void;
  setRangeEnd: (timeUs: number | null) => void;
  clearRange: () => void;
  updateCanvas: (canvas: EditorProject["canvas"]) => void;
  updatePresenterSafeArea: (settings: PresenterSafeAreaSettings) => void;
  updateMotionTheme: (patch: Partial<Omit<MotionTheme, "colors">> & { colors?: Partial<MotionTheme["colors"]> }) => void;
  updateChapterProgress: (patch: Partial<ChapterProgressSettings>) => void;
  addComposition: (compositionId: string) => void;
  addShotcraftSequence: (plan: ShotcraftPlan, assets: readonly MediaAsset[], options: ShotcraftSequenceOptions) => void;
  addVideo: (asset: MediaAsset) => void;
  addImage: (asset: MediaAsset) => void;
  addAudio: (asset: MediaAsset, role?: AudioRole, startUs?: number, sourceBlockId?: string) => void;
  addExtractedAudio: (asset: MediaAsset, sourceVideoAssetId: string) => void;
  placeAsset: (assetId: string, placement?: "auto" | "main" | "overlay") => void;
  updateAsset: (assetId: string, patch: Partial<MediaAsset>) => void;
  replaceProject: (project: EditorProject) => void;
  addGeneratedPlan: (plan: AiVideoPlan, prompt: string, mode: InsertMode, target?: { startUs: number; durationUs?: number }) => string;
  applyMotionMatches: (subtitleIds: string[], matches: AiMotionMatch[]) => MotionMatchApplySummary;
  applySoundMatches: (subtitleIds: string[], matches: AiSoundMatch[], soundAssets?: MediaAsset[]) => number;
  alignGeneratedBlockDuration: (blockId: string, durationUs: number) => void;
  alignGeneratedSceneDurations: (blockId: string, durationsUs: number[], subtitleIds?: string[]) => void;
  updateComposition: (clipId: string, patch: Partial<CompositionClip>) => void;
  bindCompositionAssets: (clipId: string, bindings: CompositionBinding[], importedAssets?: MediaAsset[]) => void;
  updateScene: (clipId: string, patch: Partial<SceneClip>) => void;
  updateVideo: (clipId: string, patch: Partial<VideoClip>) => void;
  applyTransitionToSelectedMaterials: (transition: VideoTransition) => void;
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
    selected.has(clip.id) && (clip.kind === "composition" || clip.kind === "scene") && clip.sceneGroupId ? [clip.sceneGroupId] : []
  )));
  if (!groups.size) return [...selected];
  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if ((clip.kind === "composition" || clip.kind === "scene") && clip.sceneGroupId && groups.has(clip.sceneGroupId)) selected.add(clip.id);
  }
  return [...selected];
}

function retimeCompositionData(clip: CompositionClip, durationUs: number) {
  const ratio = durationUs / clip.durationUs;
  if (mediaComposition(clip.compositionId)) {
    clip.animationDurationUs = Math.round((clip.animationDurationUs ?? clip.durationUs * clip.speed) * ratio);
    clip.sourceOffsetUs = Math.round((clip.sourceOffsetUs ?? 0) * ratio);
  } else if (!clip.recipe?.sceneBackground) clip.speed = Math.max(0.25, Math.min(3, clip.speed / ratio));
  clip.transformKeyframes = clip.transformKeyframes?.map(frame => ({ ...frame, offsetUs: Math.round(frame.offsetUs * ratio) }));
  if (clip.dimAtUs !== undefined) clip.dimAtUs = Math.round(clip.dimAtUs * ratio);
  clip.soundCues = clip.soundCues?.map(cue => ({ ...cue, offsetUs: Math.round(cue.offsetUs * ratio), durationUs: Math.max(50_000, Math.min(3_000_000, Math.round(cue.durationUs * ratio))) }));
  clip.durationUs = durationUs;
}

function stretchSceneGroup(project: EditorProject, clip: CompositionClip | SceneClip, edge: "start" | "end", deltaUs: number) {
  if (!clip.sceneGroupId) return false;
  const members = project.tracks.flatMap((track) => track.clips.map((candidate) => ({ candidate, track })))
    .filter((entry): entry is { candidate: CompositionClip | SceneClip; track: TimelineTrack } => (
      (entry.candidate.kind === "composition" || entry.candidate.kind === "scene") && entry.candidate.sceneGroupId === clip.sceneGroupId
    ));
  if (!members.length || members.some(({ candidate, track }) => candidate.locked || track.locked)) return true;
  const groupStartUs = Math.min(...members.map(({ candidate }) => candidate.startUs));
  const groupEndUs = Math.max(...members.map(({ candidate }) => candidate.startUs + candidate.durationUs));
  const spanUs = Math.max(100_000, groupEndUs - groupStartUs);
  const nextStartUs = edge === "start" ? Math.max(0, Math.min(groupEndUs - 100_000, groupStartUs + deltaUs)) : groupStartUs;
  const nextEndUs = edge === "end" ? Math.max(groupStartUs + 100_000, groupEndUs + deltaUs) : groupEndUs;
  const ratio = sceneGroupRetimeRatio(members.map(({ candidate }) => candidate), (nextEndUs - nextStartUs) / spanUs);
  for (const { candidate } of members) {
    candidate.startUs = Math.round(nextStartUs + (candidate.startUs - groupStartUs) * ratio);
    if (candidate.kind === "composition") {
      retimeCompositionData(candidate, Math.max(100_000, Math.round(candidate.durationUs * ratio)));
      continue;
    }
    candidate.durationUs = Math.max(100_000, Math.round(candidate.durationUs * ratio));
    if (candidate.dimAtUs !== undefined) candidate.dimAtUs = Math.round(candidate.dimAtUs * ratio);
    candidate.soundCues = candidate.soundCues?.map((cue) => ({ ...cue, offsetUs: Math.round(cue.offsetUs * ratio), durationUs: Math.max(50_000, Math.round(cue.durationUs * ratio)) }));
  }
  return true;
}

function visualInsertion(project: EditorProject, selectedClipId: string | null, fallbackStartUs: number, sequential: boolean) {
  const selected = sequential ? findClip(project, selectedClipId) : undefined;
  if (selected?.kind !== "video" && selected?.kind !== "image") return { startUs: fallbackStartUs, selected: undefined };
  return { startUs: selected.startUs + selected.durationUs, selected };
}

function videoTrackForPlacement(project: EditorProject, startUs: number, _placement: "auto" | "main" | "overlay" = "auto", durationUs = 1, preferredTrackId?: string): TimelineTrack {
  const videoTracks = project.tracks.filter((track) => track.kind === "video");
  const endUs = startUs + Math.max(1, durationUs);
  const available = (track: TimelineTrack) => !track.locked && !track.clips.some((clip) => startUs < clip.startUs + clip.durationUs && endUs > clip.startUs);
  const preferred = videoTracks.find((track) => track.id === preferredTrackId && available(track))
    ?? videoTracks.find(available);
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
  const zIndex = first ? DEFAULT_VIDEO_LAYER : Math.max(DEFAULT_VIDEO_LAYER, ...active.map((clip) => clip.zIndex ?? DEFAULT_VIDEO_LAYER)) + 10;
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

function splitVideoKeyframes(clip: VideoClip | CompositionClip, atUs: number) {
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
        sourceAssetId: block.id, sourceBlockId: block.id, backgroundColor: "#000000", fontSize: 44, positionY: 88,
        ...DEFAULT_SUBTITLE_STYLE, ...project.subtitleTheme
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
  addShotcraftSequence: (plan, assets, options) => {
    const state = get();
    const next = commit(state, (project) => { appendShotcraftSequence(project, plan, assets, options, () => crypto.randomUUID()); });
    set({ ...next, selectedClipId: null, selectedClipIds: [], playheadUs: options.startUs });
  },
  requestPreview: (startUs, endUs) => set((state) => {
    const boundedStartUs = Math.max(0, startUs);
    return { previewRequest: { id: (state.previewRequest?.id ?? 0) + 1, startUs: boundedStartUs, endUs: Math.max(boundedStartUs + 100_000, endUs) } };
  }),
  selectClip: (selectedClipId, additive = false) => set((state) => {
    if (!selectedClipId) return { selectedClipId: null, selectedClipIds: [] };
    const groupIds = [selectedClipId];
    if (!additive) return { selectedClipId, selectedClipIds: groupIds };
    const selectedClipIds = groupIds.every((id) => state.selectedClipIds.includes(id))
      ? state.selectedClipIds.filter((id) => !groupIds.includes(id))
      : [...new Set([...state.selectedClipIds, ...groupIds])];
    return { selectedClipIds, selectedClipId: selectedClipIds.includes(selectedClipId) ? selectedClipId : selectedClipIds.at(-1) ?? null };
  }),
  selectSceneGroup: (groupId) => set((state) => {
    const selectedClipIds = state.project.tracks.flatMap(track => track.clips).filter(clip => (clip.kind === "composition" || clip.kind === "scene") && clip.sceneGroupId === groupId).map(clip => clip.id);
    return { selectedClipIds, selectedClipId: selectedClipIds[0] ?? null };
  }),
  retimeSceneGroup: (groupId, durationUs) => set((state) => {
    if (!Number.isFinite(durationUs)) return state;
    const members = state.project.tracks.flatMap(track => track.clips.map(clip => ({ clip, track }))).filter(({ clip }) => (clip.kind === "composition" || clip.kind === "scene") && clip.sceneGroupId === groupId);
    if (!members.length || members.some(({ clip, track }) => clip.locked || track.locked)) return state;
    const startUs = Math.min(...members.map(({ clip }) => clip.startUs));
    const endUs = Math.max(...members.map(({ clip }) => clip.startUs + clip.durationUs));
    return commit(state, project => {
      const clip = findClip(project, members[0].clip.id);
      if (clip?.kind === "composition" || clip?.kind === "scene") stretchSceneGroup(project, clip, "end", Math.max(250_000, Math.round(durationUs)) - (endUs - startUs));
    });
  }),
  retimeComposition: (clipId, durationUs) => set((state) => {
    const clip = findClip(state.project, clipId);
    if (!clip || clip.kind !== "composition" || clip.locked || state.project.tracks.find(t => t.id === clip.trackId)?.locked || !Number.isFinite(durationUs)) return state;
    const bounds = compositionRetimeBounds(clip);
    const nextDurationUs = Math.max(bounds.min, Math.min(bounds.max, Math.round(durationUs)));
    if (nextDurationUs === clip.durationUs) return state;
    return commit(state, project => {
      const next = findClip(project, clipId);
      if (next?.kind === "composition") retimeCompositionData(next, nextDurationUs);
    });
  }),
  setPlayhead: (playheadUs) => {
    if (!Number.isFinite(playheadUs)) return;
    set({ playheadUs: Math.max(0, Math.round(playheadUs)) });
  },
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
  updatePresenterSafeArea: (settings) => set((state) => commit(state, (project) => {
    project.presenterSafeArea = normalizePresenterSafeArea(settings);
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
  addComposition: (compositionId) => {
    const definition = compositionById(compositionId);
    if (get().project.tracks.find((track) => track.kind === "composition")?.locked) return;
    const groupId = definition.kind === "scene" ? crypto.randomUUID() : undefined;
    const layers = definition.kind === "scene"
      ? createGeneratedEffectLayers([definition.id], definition.defaultText, definition.defaultAccentColor, definition.defaultDurationUs, "scene-template")
      : [];
    const id = layers[0]?.id ?? crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const track = project.tracks.find((candidate) => candidate.kind === "composition")!;
        const themeAccentColor = motionThemeAccentColor(project.motionTheme);
        if (definition.kind === "scene") {
          for (const layer of layers) {
            const clip: CompositionClip = {
              id: layer.id, trackId: track.id, kind: "composition", label: `${definition.name} · ${compositionById(layer.compositionId).name}`,
              startUs: state.playheadUs + layer.startOffsetUs, durationUs: layer.durationUs, locked: false,
              compositionId: layer.compositionId, text: layer.text, color: layer.textColor, accentColor: themeAccentColor,
              fontSize: layer.fontSize, speed: layer.speed, transform: layer.transform, recipe: layer.recipe,
              soundCues: layer.soundCues,
              zIndex: 200 + layer.zIndex, sceneGroupId: groupId, sceneTemplateId: definition.id, matchQuery: layer.matchQuery,
              colorRole: motionColorRoleForEffect(layer.compositionId),
              backdrop: { ...DEFAULT_EFFECT_BACKDROP, enabled: !OVERLAY_STUDIO_EFFECT_IDS.includes(layer.compositionId as (typeof OVERLAY_STUDIO_EFFECT_IDS)[number]) },
              params: structuredClone(compositionById(layer.compositionId).defaultParams ?? {})
            };
            track.clips.push(clip);
          }
        } else if (definition.recipe.sceneBackground) {
          const sceneTrack = track;
          const background = structuredClone(definition.recipe.sceneBackground);
          if (BUILTIN_EFFECTS.some((effect) => effect.id === definition.id)) background.borderColor = themeAccentColor;
          const clip: SceneClip = {
            id, trackId: sceneTrack.id, kind: "scene", label: definition.name, startUs: state.playheadUs,
            durationUs: definition.defaultDurationUs, locked: false, compositionId,
            background, opacity: 1,
            soundCues: structuredClone(definition.soundCues ?? [])
          };
          sceneTrack.clips.push(sceneBackgroundComposition(clip));
        } else {
          const clip: CompositionClip = {
            id, trackId: track.id, kind: "composition", label: definition.name, startUs: state.playheadUs,
            durationUs: definition.defaultDurationUs, locked: false, compositionId, text: definition.defaultText,
            bindings: [], sourceOffsetUs: 0, animationDurationUs: definition.defaultDurationUs,
            shotcraft: isShotcraftComposition(compositionId) ? defaultShotcraftSettings(compositionId) : undefined,
            color: definition.defaultColor, accentColor: themeAccentColor,
            fontSize: recommendedEffectFontSizeForId(definition.id, definition.recipe, definition.defaultText), speed: 1,
            transform: defaultEffectTransform(compositionId), recipe: structuredClone(definition.recipe), zIndex: compositionLayer({ compositionId, recipe: definition.recipe }),
            soundCues: structuredClone(definition.soundCues ?? []),
            colorRole: motionColorRoleForEffect(compositionId),
            backdrop: { ...DEFAULT_EFFECT_BACKDROP, enabled: !isShotcraftComposition(compositionId) && !OVERLAY_STUDIO_EFFECT_IDS.includes(compositionId as (typeof OVERLAY_STUDIO_EFFECT_IDS)[number]) },
            params: structuredClone(definition.defaultParams ?? {})
          };
          if (!mediaComposition(definition.id) && !isShotcraftComposition(definition.id)) placeNewEffect(project, clip);
          else clip.transform = { ...DEFAULT_TRANSFORM };
          track.clips.push(clip);
        }
      }),
      selectedClipId: id,
      selectedClipIds: [id],
      ...(isBackgroundComposition(compositionId) ? { previewRequest: { id: (state.previewRequest?.id ?? 0) + 1, startUs: state.playheadUs, endUs: state.playheadUs + definition.defaultDurationUs } } : {})
    }));
  },
  addVideo: (asset) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const hasVisualContent = project.tracks.some((track) => ["video", "image", "generated", "scene", "composition"].includes(track.kind) && track.clips.length > 0);
        if (!hasVisualContent && asset.width && asset.height) {
          project.canvas = {
            width: Math.max(64, Math.min(7680, Math.round(asset.width / 2) * 2)),
            height: Math.max(64, Math.min(7680, Math.round(asset.height / 2) * 2)),
            fpsNumerator: asset.fpsNumerator ?? project.canvas.fpsNumerator,
            fpsDenominator: asset.fpsDenominator ?? project.canvas.fpsDenominator
          };
        }
        project.assets.push(asset);
        const insertion = visualInsertion(project, state.selectedClipId, state.playheadUs, true);
        const track = videoTrackForPlacement(project, insertion.startUs, "auto", asset.durationUs, insertion.selected?.kind === "video" ? insertion.selected.trackId : undefined);
        track.clips.push({
          id,
          trackId: track.id,
          kind: "video",
          label: asset.name,
          startUs: insertion.startUs,
          durationUs: asset.durationUs,
          locked: false,
          assetId: asset.id,
          sourceInUs: 0,
          playbackRate: 1,
          fit: "contain",
          camera: cameraMotionForPreset("none"),
          ...videoClipFields(project, insertion.startUs)
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
        const insertion = visualInsertion(project, state.selectedClipId, state.playheadUs, true);
        const track = project.tracks.find((candidate) => candidate.kind === "image")!;
        track.clips.push({
          id,
          trackId: track.id,
          kind: "image",
          label: asset.name,
          startUs: insertion.startUs,
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
          const insertion = visualInsertion(project, state.selectedClipId, state.playheadUs, placement === "auto");
          if (asset.kind === "video") {
            const track = videoTrackForPlacement(project, insertion.startUs, placement, asset.durationUs, insertion.selected?.kind === "video" ? insertion.selected.trackId : undefined);
            track.clips.push({ id, trackId: track.id, kind: "video", label: asset.name, startUs: insertion.startUs, durationUs: asset.durationUs, locked: false, assetId, sourceInUs: 0, playbackRate: 1, fit: "contain", camera: cameraMotionForPreset("none"), ...videoClipFields(project, insertion.startUs, placement) });
          } else if (asset.kind === "image") {
            const track = project.tracks.find((candidate) => candidate.kind === "image")!;
            track.clips.push({ id, trackId: track.id, kind: "image", label: asset.name, startUs: insertion.startUs, durationUs: asset.durationUs || 5_000_000, locked: false, assetId, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1 });
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
    const targetDurationUs = target?.durationUs;
    const requestedStartUs = target?.startUs ?? get().playheadUs;
    const durationUs = typeof targetDurationUs === "number" && Number.isFinite(targetDurationUs)
      ? Math.max(100_000, Math.round(targetDurationUs))
      : plannedDurationUs;
    const startUs = Number.isFinite(requestedStartUs) ? Math.max(0, Math.round(requestedStartUs)) : 0;
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
            const definition = compositionById(match?.primaryEffectId ?? "quote-lockup");
            return {
              id: crypto.randomUUID(), title: caption.text.slice(0, 80), narration: caption.text,
              durationUs: Math.max(100_000, caption.endUs - caption.startUs), compositionId: definition.id,
              textColor: definition.defaultColor, accentColor: themeAccentColor,
              fontSize: recommendedEffectFontSizeForId(definition.id, definition.recipe, caption.text), speed: 1, transform: { x: match?.x ?? 50, y: match?.y ?? 30, scale: aiEffectScale(definition.id, match?.scale ?? 1, Boolean(definition.recipe.chart)), rotation: 0, opacity: 1 },
              mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForPreset(match?.cameraPreset ?? "none")
            };
          })
        };
        track.clips.push(clip);

        const subtitleTrack = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
        const sceneTrack = project.tracks.find((candidate) => candidate.kind === "composition")!;
        const effectTrack = project.tracks.find((candidate) => candidate.kind === "composition")!;
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
            .filter((candidate) => candidate.kind === "composition" && !candidate.hidden)
            .flatMap((candidate) => candidate.clips)
            .filter((candidate): candidate is CompositionClip => candidate.kind === "composition")
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
            sourceAssetId: id, sourceBlockId: id, backgroundColor: "#000000", fontSize: 44, positionY: 88,
            ...DEFAULT_SUBTITLE_STYLE,
            ...project.subtitleTheme,
            highlightWords: subtitleKeywordsForText(caption.text, matchByCaption.get(captionIndex)?.subtitleKeywords ?? [])
          });
          const effectEntries = match ? aiMotionEntries(match, caption.text, true) : [];
          for (const entry of effectEntries.slice(0, 2)) {
            if (!match) break;
            const definition = compositionById(entry.compositionId);
            const bindings = entry.slot === "primary" && compositionSlots(definition.id).length > 0
              ? normalizeBindings(match.compositionBindings)
              : [];
            if (compositionBindingIssues({ compositionId: definition.id, bindings }, project.assets).length) continue;
            const recipe = materializedAiEffectRecipe(entry.compositionId, match);
            const backgroundComposition = isBackgroundComposition(definition.id);
            const placement = recipe.sceneBackground || backgroundComposition ? null : motionPlacements.get(aiMotionLayoutId(captionIndex, entry.slot));
            if (!recipe.sceneBackground && !backgroundComposition && !placement) continue;
            const sceneGroupId = match?.motionGroupId ? `ai-motion:${id}:${match.motionGroupId}` : `ai-caption:${id}:${captionIndex}`;
            const soundCues: NonNullable<CompositionClip["soundCues"]> = [];
            if (recipe.sceneBackground) {
              sceneTrack.clips.push(sceneBackgroundComposition({
                id: crypto.randomUUID(), trackId: sceneTrack.id, kind: "scene", label: `AI 场景 · ${definition.name}`,
                startUs: cueStartUs, durationUs: cueDurationUs, locked: false, compositionId: definition.id,
                background: { ...structuredClone(recipe.sceneBackground), borderColor: themeAccentColor }, opacity: 1, soundCues, sceneGroupId, matchQuery: caption.text,
                sourceBlockId: id, sourceSubtitleId: subtitleId
              }));
            } else {
              effectTrack.clips.push({
                id: crypto.randomUUID(), trackId: effectTrack.id, kind: "composition", label: `AI 动效 · ${definition.name}`,
                startUs: cueStartUs, durationUs: cueDurationUs, locked: false, compositionId: definition.id, text: entry.text,
                color: definition.defaultColor, accentColor: themeAccentColor,
                fontSize: recommendedEffectFontSizeForId(definition.id, recipe, entry.text), speed: 1,
                transform: backgroundComposition ? { ...DEFAULT_TRANSFORM } : { x: placement!.x, y: placement!.y, scale: placement!.scale, rotation: 0, opacity: 1 },
                recipe, soundCues, zIndex: backgroundComposition ? compositionLayer({ compositionId: definition.id, recipe }) : 200 + entry.zIndex, sceneGroupId, matchQuery: caption.text,
                colorRole: motionColorRoleForEffect(definition.id),
                sourceBlockId: id, sourceSubtitleId: subtitleId,
                backdrop: effectBackdropForPreset(match?.backdropPreset ?? "none", themeAccentColor),
                bindings,
                params: effectParamsForText(definition.id, entry.text)
              });
            }
          }
          const addVideoLayer = (layer: AiMotionMatch["videoLayers"][number], layerIndex: number) => {
            const asset = project.assets.find((candidate) => candidate.id === layer.assetId && candidate.kind === "video" && !candidate.missing);
            if (!asset || asset.durationUs <= 0) return;
            const videoTrack = videoTrackForPlacement(project, cueStartUs, "auto", cueDurationUs);
            const layout = videoLayoutForPreset(layer.layoutPreset, cueDurationUs);
            const activeZ = project.tracks.flatMap((candidate) => candidate.clips).filter((candidate): candidate is VideoClip => candidate.kind === "video" && cueStartUs < candidate.startUs + candidate.durationUs && cueStartUs + cueDurationUs > candidate.startUs).map((candidate) => candidate.zIndex ?? DEFAULT_VIDEO_LAYER);
            const zIndex = layer.layoutPreset === "full" && activeZ.length === 0 ? DEFAULT_VIDEO_LAYER : Math.max(layout.zIndex, activeZ.length ? Math.max(...activeZ) + 10 : DEFAULT_VIDEO_LAYER + layerIndex * 10);
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
  applyMotionMatches: (subtitleIds, matches) => {
    const summary: MotionMatchApplySummary = {
      requestedEffectCount: 0,
      effectCount: 0,
      sceneCount: 0,
      soundCount: 0,
      videoCount: 0,
      skippedEffectCount: 0
    };
    if (!subtitleIds.length) return summary;
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
      const effectTrack = project.tracks.find((track) => track.kind === "composition")!;
      const sceneTrack = effectTrack;
      const lockedMotionSubtitleIds = new Set(effectTrack.clips.flatMap((clip) => (
        clip.locked && (clip.kind === "composition" || clip.kind === "scene") && clip.sourceSubtitleId ? [clip.sourceSubtitleId] : []
      )));
      if (!effectTrack.locked) effectTrack.clips = effectTrack.clips.filter((clip) => clip.locked || clip.kind !== "composition" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
      if (!sceneTrack.locked) sceneTrack.clips = sceneTrack.clips.filter((clip) => clip.locked || clip.kind !== "scene" || !clip.sourceSubtitleId || !selectedIds.has(clip.sourceSubtitleId));
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
      const timingCaptions = subtitles.map((subtitle) => ({
        startSeconds: subtitle.startUs / 1_000_000,
        endSeconds: (subtitle.startUs + subtitle.durationUs) / 1_000_000
      }));
      const motionPlacements = resolveAiMotionPlacements(
        project,
        matches,
        motionCaptions,
        false,
        project.tracks
          .filter((candidate) => candidate.kind === "composition" && !candidate.hidden)
          .flatMap((candidate) => candidate.clips)
          .filter((candidate): candidate is CompositionClip => candidate.kind === "composition")
      );

      const addMatchedVideo = (subtitle: SubtitleClip, durationUs: number, layer: AiMotionMatch["videoLayers"][number], labelPrefix: string, sourceVideo?: VideoClip) => {
        const asset = project.assets.find((candidate) => candidate.id === layer.assetId && candidate.kind === "video" && !candidate.missing);
        if (!asset || asset.durationUs <= 0) return;
        const track = videoTrackForPlacement(project, subtitle.startUs, "auto", durationUs);
        const preset = layer.layoutPreset ?? "picture-in-picture-top-right";
        const layout = videoLayoutForPreset(preset, durationUs);
        const boundedSourceInUs = Math.min(Math.max(0, Math.round(layer.sourceInSeconds * 1_000_000)), Math.max(0, asset.durationUs - 1));
        const availableUs = Math.max(1, asset.durationUs - boundedSourceInUs);
        const playbackRate = Math.min(sourceVideo?.playbackRate ?? 1, availableUs / durationUs);
        const activeZ = project.tracks.flatMap((candidate) => candidate.clips).filter((candidate): candidate is VideoClip => candidate.kind === "video" && subtitle.startUs < candidate.startUs + candidate.durationUs && subtitle.startUs + durationUs > candidate.startUs).map((candidate) => candidate.zIndex ?? DEFAULT_VIDEO_LAYER);
        const zIndex = preset === "full" && activeZ.length === 0 ? DEFAULT_VIDEO_LAYER : Math.max(layout.zIndex, activeZ.length ? Math.max(...activeZ) + 10 : 30);
        track.clips.push({
          id: crypto.randomUUID(), trackId: track.id, kind: "video", label: `${labelPrefix} · ${asset.name}`,
          startUs: subtitle.startUs, durationUs, locked: false, assetId: asset.id,
          sourceInUs: boundedSourceInUs, playbackRate, volume: layer.volume, fit: sourceVideo?.fit ?? "cover", camera: cameraMotionForPreset(layer.cameraPreset),
          zIndex, transform: structuredClone(sourceVideo?.transform ?? layout.transform), transformKeyframes: layout.transformKeyframes,
          layoutPreset: preset, sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id,
          role: layer.role, mask: sourceVideo?.mask ? structuredClone(sourceVideo.mask) : { ...DEFAULT_VIDEO_MASK, shape: layer.shapePreset },
          transition: { ...DEFAULT_VIDEO_TRANSITION, preset: layer.transitionPreset },
          focus: layer.focus ? { ...DEFAULT_VIDEO_FOCUS, enabled: layer.focus.enabled, x: layer.focus.x, y: layer.focus.y, zoom: layer.focus.zoom, startOffsetUs: Math.round(layer.focus.startOffsetSeconds * 1_000_000), durationUs: Math.min(durationUs, Math.round(layer.focus.durationSeconds * 1_000_000)) } : undefined
        });
        summary.videoCount += 1;
      };

      subtitles.forEach((subtitle, captionIndex) => {
        const match = matches.find((candidate) => candidate.captionIndex === captionIndex);
        if (!match) return;
        const persistUntilCaptionIndex = match.motionGroupId
          ? Math.min(subtitles.length - 1, Math.max(captionIndex, match.persistUntilCaptionIndex ?? captionIndex))
          : captionIndex;
        const endSubtitle = subtitles[persistUntilCaptionIndex] ?? subtitle;
        const matchDurationUs = Math.max(100_000, endSubtitle.startUs + endSubtitle.durationUs - subtitle.startUs);
        if (!subtitle.locked && !project.tracks.find((track) => track.id === subtitle.trackId)?.locked) {
          subtitle.highlightWords = subtitleKeywordsForText(subtitle.text, match.subtitleKeywords ?? []);
        }
        const entries = aiMotionEntries(match, subtitle.text, false);
        const requestedEntries = entries.slice(0, 2);
        const selectedEntries = lockedMotionSubtitleIds.has(subtitle.id) ? [] : requestedEntries;
        summary.requestedEffectCount += requestedEntries.length;
        if (lockedMotionSubtitleIds.has(subtitle.id)) summary.skippedEffectCount += requestedEntries.length;
        for (const entry of selectedEntries) {
          const definition = compositionById(entry.compositionId);
          if (effectTrack.locked || (definition.recipe.sceneBackground && sceneTrack.locked)) { summary.skippedEffectCount += 1; continue; }
          if (mediaComposition(definition.id)) {
            const bindings = normalizeBindings(match.compositionBindings);
            const placeholder = entry.materialPlaceholder && bindings.length === 0;
            if (compositionBindingIssues({ compositionId: definition.id, bindings }, project.assets).length && !placeholder) { summary.skippedEffectCount += 1; continue; }
            const durationUs = isSequencedMediaComposition(definition.id) ? Math.max(2_000_000, Math.min(10_000_000, matchDurationUs)) : matchDurationUs;
            effectTrack.clips.push({
              id: crypto.randomUUID(), trackId: effectTrack.id, kind: "composition", label: `AI 动效 · ${definition.name}${placeholder ? " · 待补素材" : ""}`,
              startUs: subtitle.startUs, durationUs, animationDurationUs: durationUs, sourceOffsetUs: 0,
              locked: false, compositionId: definition.id, bindings, text: "", color: definition.defaultColor,
              accentColor: themeAccentColor, fontSize: 48, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
              params: compileAiMotionParams({
                effect: definition,
                baseParams: structuredClone(definition.defaultParams ?? {}),
                overrides: entry.params,
                timingCaptionIndices: entry.timingCaptionIndices,
                captions: timingCaptions,
                startCaptionIndex: captionIndex,
                endCaptionIndex: persistUntilCaptionIndex,
                text: entry.text
              }),
              sourceSubtitleId: subtitle.id, zIndex: compositionLayer({ compositionId: definition.id, recipe: definition.recipe }),
              lintOff: placeholder ? ["composition-input"] : undefined
            });
            summary.effectCount += 1;
            continue;
          }
          const recipe = materializedAiEffectRecipe(entry.compositionId, match);
          const backgroundComposition = isBackgroundComposition(definition.id);
          const placement = recipe.sceneBackground || backgroundComposition ? null : motionPlacements.get(aiMotionLayoutId(captionIndex, entry.slot));
          if (!recipe.sceneBackground && !backgroundComposition && !placement) {
            summary.skippedEffectCount += 1;
            continue;
          }
          const sceneGroupId = match.motionGroupId ? motionGroupSceneIds.get(match.motionGroupId) : `ai-subtitle:${subtitle.id}`;
          const soundCues: NonNullable<CompositionClip["soundCues"]> = [];
          if (recipe.sceneBackground) {
            sceneTrack.clips.push(sceneBackgroundComposition({
              id: crypto.randomUUID(), trackId: sceneTrack.id, kind: "scene", label: `AI 场景 · ${definition.name}`,
              startUs: subtitle.startUs, durationUs: matchDurationUs, locked: false, compositionId: definition.id,
              background: { ...structuredClone(recipe.sceneBackground), borderColor: themeAccentColor }, opacity: 1, soundCues, sceneGroupId, matchQuery: subtitle.text,
              sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id
            }));
            summary.sceneCount += 1;
          } else {
            const bindings = entry.slot === "primary" && compositionSlots(definition.id).length > 0
              ? normalizeBindings(match.compositionBindings)
              : [];
            const placeholder = entry.materialPlaceholder && bindings.length === 0;
            if (compositionBindingIssues({ compositionId: definition.id, bindings }, project.assets).length && !placeholder) { summary.skippedEffectCount += 1; continue; }
            effectTrack.clips.push({
              id: crypto.randomUUID(), trackId: effectTrack.id, kind: "composition", label: `AI 动效 · ${definition.name}${placeholder ? " · 待补素材" : ""}`,
              startUs: subtitle.startUs, durationUs: matchDurationUs, locked: false, compositionId: definition.id, text: entry.text.trim(),
              color: definition.defaultColor, accentColor: themeAccentColor,
              fontSize: recommendedEffectFontSizeForId(definition.id, recipe, entry.text.trim()), speed: 1,
              transform: backgroundComposition ? { ...DEFAULT_TRANSFORM } : { x: placement!.x, y: placement!.y, scale: placement!.scale, rotation: 0, opacity: 1 }, recipe,
              soundCues, zIndex: backgroundComposition ? compositionLayer({ compositionId: definition.id, recipe }) : 200 + entry.zIndex, sceneGroupId, matchQuery: subtitle.text,
              colorRole: motionColorRoleForEffect(definition.id),
              sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id,
              backdrop: effectBackdropForPreset(match.backdropPreset ?? "none", themeAccentColor),
              bindings,
              lintOff: placeholder ? ["composition-input"] : undefined,
              params: compileAiMotionParams({
                effect: definition,
                baseParams: effectParamsForText(definition.id, entry.text.trim()),
                overrides: entry.params,
                timingCaptionIndices: entry.timingCaptionIndices,
                captions: timingCaptions,
                startCaptionIndex: captionIndex,
                endCaptionIndex: persistUntilCaptionIndex,
                text: entry.text
              })
            });
            summary.effectCount += 1;
          }
        }

        if (match.cameraPreset !== "none" && subtitle.sourceAssetId) {
          const sourceVideo = project.tracks.flatMap((track) => track.clips).find((clip): clip is VideoClip => (
            clip.kind === "video" && clip.assetId === subtitle.sourceAssetId && !clip.sourceSubtitleId
            && clip.startUs <= subtitle.startUs && clip.startUs + clip.durationUs >= subtitle.startUs + matchDurationUs
          ));
          const sourceTrack = project.tracks.find((track) => track.id === sourceVideo?.trackId);
          if (sourceVideo && !sourceVideo.locked && !sourceTrack?.locked && !sourceTrack?.hidden
            && !sourceVideo.transformKeyframes?.length && !sourceVideo.presentationCues?.length) {
            const sourceInUs = sourceVideo.sourceInUs + Math.round((subtitle.startUs - sourceVideo.startUs) * sourceVideo.playbackRate);
            addMatchedVideo(subtitle, matchDurationUs, { assetId: sourceVideo.assetId, role: sourceVideo.role ?? "a-roll", sourceInSeconds: sourceInUs / 1_000_000, layoutPreset: "full", shapePreset: sourceVideo.mask?.shape ?? "rectangle", transitionPreset: "none", cameraPreset: match.cameraPreset, volume: 0, focus: null }, "AI 运镜", sourceVideo);
          }
        }
        matchedVideoLayers(match).forEach((layer) => addMatchedVideo(subtitle, matchDurationUs, layer, "AI 素材"));
      });
    }));
    return summary;
  },
  applySoundMatches: (subtitleIds, matches, soundAssets = []) => {
    let count = 0;
    const state = get();
    const selectedIds = new Set(subtitleIds);
    const soundTrack = state.project.tracks.find((track) => track.kind === "audio" && track.audioRole === "sound");
    if (!selectedIds.size || !soundTrack || soundTrack.locked) return count;
    const subtitles = state.project.tracks.flatMap((track) => track.clips)
      .filter((clip): clip is SubtitleClip => clip.kind === "subtitle" && selectedIds.has(clip.id))
      .sort((left, right) => left.startUs - right.startUs);
    const lockedSubtitleIds = new Set(soundTrack.clips.filter((clip) => clip.locked).map((clip) => clip.sourceSubtitleId));
    const editableIds = new Set(subtitles.filter((clip) => !lockedSubtitleIds.has(clip.id)).map((clip) => clip.id));
    if (!editableIds.size) return count;
    set((current) => commit(current, (project) => {
      const track = project.tracks.find((candidate) => candidate.id === soundTrack.id)!;
      track.clips = track.clips.filter((clip) => clip.locked || clip.kind !== "audio" || !clip.sourceSubtitleId || !editableIds.has(clip.sourceSubtitleId));
      const seen = new Set<number>();
      for (const match of matches) {
        const subtitle = subtitles[match.captionIndex];
        if (!subtitle || !editableIds.has(subtitle.id) || seen.has(match.captionIndex)) continue;
        seen.add(match.captionIndex);
        const definition = match.soundEffectId ? builtinSoundEffectById(match.soundEffectId) : undefined;
        if (!definition) continue;
        const assetId = builtinSoundAssetId(definition.id);
        const asset = soundAssets.find((candidate) => candidate.id === assetId) ?? project.assets.find((candidate) => candidate.id === assetId);
        if (!asset || asset.kind !== "audio" || asset.missing || !Number.isFinite(asset.durationUs) || asset.durationUs <= 0) continue;
        const existing = project.assets.find((candidate) => candidate.id === assetId);
        if (existing) Object.assign(existing, asset);
        else project.assets.push(structuredClone(asset));
        track.clips.push({
          id: crypto.randomUUID(), trackId: track.id, kind: "audio", label: `AI 音效 · ${definition.name}`,
          startUs: subtitle.startUs, durationUs: Math.round(asset.durationUs), locked: false, assetId,
          sourceInUs: 0, playbackRate: 1, volume: 1, fadeInUs: 0, fadeOutUs: Math.min(50_000, Math.round(asset.durationUs)), role: "sound",
          sourceBlockId: subtitle.sourceBlockId, sourceSubtitleId: subtitle.id
        });
        count += 1;
      }
    }));
    return count;
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
        || ((clip.kind === "scene" || clip.kind === "composition") && clip.sceneGroupId?.startsWith(`ai-caption:${blockId}:`));
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
        if ((clip.kind === "video" || clip.kind === "composition") && clip.transformKeyframes?.length) {
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
        if ((clip.kind === "video" || clip.kind === "composition") && clip.transformKeyframes?.length) {
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
  updateComposition: (clipId, patch) => set((state) => {
    const existing = findClip(state.project, clipId);
    if (!existing || existing.kind !== "composition" || existing.locked || state.project.tracks.find((track) => track.id === existing.trackId)?.locked) return state;
    return commit(state, (project) => {
      const clip = findClip(project, clipId);
      if (!clip || clip.kind !== "composition") return;
      const settings = isShotcraftComposition(clip.compositionId) && patch.shotcraft
        ? normalizeShotcraftSettings(patch.shotcraft, clip.compositionId) : undefined;
      if (settings) Object.assign(clip, shotcraftHoldPatch(clip, settings));
      Object.assign(clip, patch);
      if (settings) clip.shotcraft = settings;
      clip.zIndex = compositionLayer(clip);
      clip.speed = Math.max(0.25, Math.min(3, Number.isFinite(clip.speed) ? clip.speed : 1));
      clip.durationUs = Math.max(100_000, Math.round(Number.isFinite(clip.durationUs) ? clip.durationUs : existing.durationUs));
      if (patch.durationUs !== undefined && isSequencedMediaComposition(clip.compositionId)) clip.durationUs = Math.max(2_000_000, Math.min(10_000_000, clip.durationUs));
      clip.startUs = Math.max(0, Math.round(Number.isFinite(clip.startUs) ? clip.startUs : existing.startUs));
      if (patch.bindings) clip.bindings = normalizeBindings(patch.bindings);
      if (patch.durationUs !== undefined && mediaComposition(clip.compositionId)) clip.animationDurationUs = Math.round(clip.durationUs * clip.speed + (clip.sourceOffsetUs ?? 0));
    });
  }),
  bindCompositionAssets: (clipId, bindings, importedAssets = []) => set((state) => {
    const existing = findClip(state.project, clipId);
    if (!existing || existing.kind !== "composition" || existing.locked || state.project.tracks.find((track) => track.id === existing.trackId)?.locked) return state;
    const normalized = normalizeBindings(bindings);
    const slots = compositionSlots(existing.compositionId);
    if (!slots.length) throw new Error("这个动效没有素材槽");
    const assets = [...state.project.assets, ...importedAssets];
    for (const binding of normalized) {
      const slot = slots.find((candidate) => candidate.id === binding.slotId);
      if (!slot || binding.assetIds.length > slot.maxItems || binding.assetIds.some((id) => !slotAccepts(slot, assets.find((asset) => asset.id === id)?.kind))) throw new Error("素材类型或数量不符合槽位要求");
    }
    const becameReady = compositionBindingIssues(existing, state.project.assets).length > 0
      && compositionBindingIssues({ ...existing, bindings: normalized }, assets).length === 0;
    return {
      ...commit(state, (project) => {
        const clip = findClip(project, clipId);
        if (!clip || clip.kind !== "composition") return;
        for (const asset of importedAssets) if (!project.assets.some((candidate) => candidate.id === asset.id)) project.assets.push(asset);
        clip.bindings = normalized;
      }),
      ...(becameReady ? { playheadUs: existing.startUs, previewRequest: { id: (state.previewRequest?.id ?? 0) + 1, startUs: existing.startUs, endUs: existing.startUs + existing.durationUs } } : {})
    };
  }),
  updateScene: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "scene") return;
    Object.assign(clip, patch);
  })),
  updateVideo: (clipId, patch) => set((state) => {
    const clip = findClip(state.project, clipId);
    if (!clip || clip.kind !== "video" || clip.locked || state.project.tracks.find((track) => track.id === clip.trackId)?.locked) return state;
    return commit(state, (project) => {
      const target = findClip(project, clipId);
      if (target?.kind === "video") {
        Object.assign(target, patch);
        target.zIndex = normalizeLayer(target.zIndex, DEFAULT_VIDEO_LAYER);
        if (patch.mask) target.mask = normalizeVideoMask(patch.mask);
      }
    });
  }),
  applyTransitionToSelectedMaterials: (transition) => set((state) => {
    const targets = selectedVisualTransitionCuts(state.project, state.selectedClipIds);
    if (!targets.length) return state;
    const targetById = new Map(targets.map(({ outgoing, incoming }) => [incoming.id, outgoing]));
    const maximumDurationUs = new Map(targets.map(({ outgoing, incoming }) => [incoming.id, Math.min(outgoing.durationUs, incoming.durationUs)]));
    return commit(state, (project) => {
      for (const clip of project.tracks.flatMap((track) => track.clips)) {
        if ((clip.kind !== "video" && clip.kind !== "image") || !targetById.has(clip.id)) continue;
        const outgoing = targetById.get(clip.id);
        if (!outgoing) continue;
        clip.transition = {
          ...transition,
          durationUs: Math.max(100_000, Math.min(maximumDurationUs.get(clip.id) ?? clip.durationUs, Math.round(transition.durationUs))),
          fromClipId: outgoing.id
        };
      }
    });
  }),
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
  updateVideoPresentationCue: (clipId, cueId, patch) => set((state) => {
    const source = findClip(state.project, clipId);
    if (!source || source.kind !== "video" || source.locked || state.project.tracks.find((track) => track.id === source.trackId)?.locked) return state;
    return commit(state, (project) => {
      const clip = findClip(project, clipId);
      if (!clip || clip.kind !== "video" || clip.locked) return;
      const cue = clip.presentationCues?.find((candidate) => candidate.id === cueId);
      if (!cue) return;
      Object.assign(cue, patch);
      if (patch.mask) cue.mask = normalizeVideoMask(patch.mask);
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
    });
  }),
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
          locked: false, text: segment.text.trim(), sourceAssetId: assetId,
          backgroundColor: "#000000", fontSize: 44, positionY: 88,
          ...DEFAULT_SUBTITLE_STYLE, ...project.subtitleTheme
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
    if (clipId === null && (patch.color !== undefined || patch.highlightColor !== undefined)) {
      project.subtitleTheme = normalizeSubtitleTheme({ ...project.subtitleTheme, ...patch });
    }
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
      const selected = new Set(clipIds);
      const clips = project.tracks.flatMap((track) => track.locked ? [] : track.clips).filter((clip) => selected.has(clip.id) && !clip.locked);
      const minimumStart = clips.reduce((minimum, clip) => Math.min(minimum, clip.startUs), Number.POSITIVE_INFINITY);
      const boundedDelta = Math.max(deltaUs, -minimumStart);
      for (const clip of clips) clip.startUs = Math.round(clip.startUs + boundedDelta);
    }));
  },
  trimClip: (clipId, edge, deltaUs) => {
    if (!Number.isFinite(deltaUs)) return;
    const roundedDeltaUs = Math.round(deltaUs);
    if (Math.abs(roundedDeltaUs) < 1) return;
    set((state) => commit(state, (project) => {
      const clip = findClip(project, clipId);
      const track = clip ? project.tracks.find((candidate) => candidate.id === clip.trackId) : undefined;
      if (!clip || clip.locked || track?.locked) return;
      const minimumDuration = clip.kind === "subtitle" ? 100_000 : 250_000;
      if (edge === "start") {
        const actualDelta = Math.min(roundedDeltaUs, clip.durationUs - minimumDuration);
        const sourceLimit = isSourceClip(clip) ? Math.ceil(-clip.sourceInUs / clip.playbackRate) : -clip.startUs;
        const boundedDelta = Math.max(actualDelta, -clip.startUs, sourceLimit);
        const presentationBoundary = clip.kind === "video" && boundedDelta > 0 ? videoPresentationAt(clip, boundedDelta) : undefined;
        clip.startUs += boundedDelta;
        clip.durationUs -= boundedDelta;
        if (clip.kind === "composition") {
          if (clip.transformKeyframes?.length) clip.transformKeyframes = splitVideoKeyframes(clip, boundedDelta).trailing;
          if (clip.dimAtUs !== undefined) clip.dimAtUs = Math.max(0, clip.dimAtUs - boundedDelta);
          clip.soundCues = clip.soundCues?.filter(cue => cue.offsetUs >= boundedDelta).map(cue => ({ ...cue, offsetUs: cue.offsetUs - boundedDelta }));
          clip.sourceOffsetUs = compositionTimeUs(clip, boundedDelta);
          clip.animationDurationUs ??= Math.round((clip.durationUs + boundedDelta) * clip.speed);
        }
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
        let durationUs = Math.max(minimumDuration, Math.round(clip.durationUs + roundedDeltaUs));
        if (isSourceClip(clip)) {
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          if (asset) {
            const availableDurationUs = Math.floor((asset.durationUs - clip.sourceInUs) / clip.playbackRate);
            durationUs = Math.min(durationUs, Math.max(minimumDuration, availableDurationUs));
          }
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
            if (clip.kind === "composition" && trailing.kind === "composition") {
              if (trailing.dimAtUs !== undefined) trailing.dimAtUs = Math.max(0, trailing.dimAtUs - firstDuration);
              trailing.soundCues = clip.soundCues?.filter(cue => cue.offsetUs >= firstDuration).map(cue => ({ ...cue, offsetUs: cue.offsetUs - firstDuration }));
              clip.soundCues = clip.soundCues?.filter(cue => cue.offsetUs < firstDuration);
              if (clip.transformKeyframes?.length) {
                const keyframes = splitVideoKeyframes(clip, firstDuration);
                clip.transformKeyframes = keyframes.leading;
                trailing.transformKeyframes = keyframes.trailing;
              }
              clip.animationDurationUs ??= Math.round(clip.durationUs * clip.speed);
              trailing.animationDurationUs = clip.animationDurationUs;
              trailing.sourceOffsetUs = compositionTimeUs(clip, firstDuration);
              if (isShotcraftComposition(clip.compositionId)) {
                for (const linked of project.tracks.flatMap((entry) => entry.clips)) {
                  if (linked.kind === "composition" && linked.shotcraft?.transition.fromClipId === clip.id) linked.shotcraft.transition.fromClipId = trailing.id;
                }
              }
            }
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
    const groupIds = new Map<string, string>();
    const copiedIds = new Map(clipboard.map((clip) => [clip.id, crypto.randomUUID()]));
    set((state) => ({
      ...commit(state, (project) => {
        for (const source of clipboard) {
          const track = project.tracks.find((candidate) => candidate.id === source.trackId && !candidate.locked);
          if (!track) continue;
          const clip = structuredClone(source);
          clip.id = copiedIds.get(source.id)!;
          if (clip.kind === "composition" && clip.shotcraft?.transition.fromClipId) {
            clip.shotcraft.transition.fromClipId = copiedIds.get(clip.shotcraft.transition.fromClipId);
          }
          clip.startUs = Math.round(state.playheadUs + source.startUs - minimumStart);
          clip.locked = false;
          if ((clip.kind === "composition" || clip.kind === "scene") && clip.sceneGroupId) {
            if (!groupIds.has(clip.sceneGroupId)) groupIds.set(clip.sceneGroupId, crypto.randomUUID());
            clip.sceneGroupId = groupIds.get(clip.sceneGroupId);
          }
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
