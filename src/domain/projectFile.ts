import { createEmptyProject, DEFAULT_MOTION_THEME, projectEndUs, VIDEO_TRANSITION_PRESETS, type ChapterProgressPosition, type ChapterProgressPreset, type ChapterProgressStyle, type EditorProject, type CompositionClip, type MotionColorRole, type MotionFont, type MotionSkin, type MotionStyle, type MotionTheme, type VideoTransition } from "@/domain/project";
import { normalizeSubtitleTheme } from "@/domain/subtitleTheme";
import { normalizePresenterSafeArea } from "@/domain/presenterSafeArea";
import { OVERLAY_STUDIO_BASE_FONT_SIZE, OVERLAY_STUDIO_EFFECT_IDS, allCompositions, compositionById, remapEffectTextParams, type CompositionParams, type EffectSoundCue, type SceneBackgroundSpec } from "@/domain/effects";
import { presenterMotionSafeArea, resolveMotionLayout, type MotionLayoutLayer, type OccupiedMotionLayoutLayer } from "@/domain/motionLayout";
import { cameraMotionForPreset } from "@/domain/camera";
import { DEFAULT_TRANSFORM } from "@/domain/transforms";
import { migrateLegacyGeneratedEffectLayout } from "@/domain/sceneEffects";
import { DEFAULT_EFFECT_BACKDROP, DEFAULT_VIDEO_FOCUS, DEFAULT_VIDEO_MASK, DEFAULT_VIDEO_TRANSITION } from "@/domain/videoPresentation";
import { CHAPTER_PROGRESS_PRESETS, DEFAULT_CHAPTER_PROGRESS, DEFAULT_SUBTITLE_STYLE } from "@/domain/videoDecorations";
import { isEasingName } from "@/domain/easing";
import { compositionAssetIds, compositionLayer, isBackgroundComposition, normalizeBindings } from "@/domain/compositions";
import { DEFAULT_VIDEO_LAYER, normalizeLayer } from "@/domain/layers";
import { normalizeVideoMask } from "@/domain/videoFrame";
import { migrateSceneTracks } from "@/domain/sceneBackground";
import { isReferenceStageComposition, referenceStageOuterTransform } from "@/domain/overlayStudioReference";
import { isShotcraftComposition, normalizeShotcraftSettings } from "@/domain/shotcraft";
import { musicAnalysisSchema } from "@/domain/musicBeats";
import { z } from "zod";

function normalizeEffectSoundCues(value: unknown): EffectSoundCue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const cue = candidate as Record<string, unknown>;
    if (typeof cue.soundId !== "string" || !cue.soundId.trim() || cue.soundId.length > 161) return [];
    if (typeof cue.offsetUs !== "number" || typeof cue.volume !== "number" || typeof cue.durationUs !== "number") return [];
    if (!Number.isFinite(cue.offsetUs) || !Number.isFinite(cue.volume) || !Number.isFinite(cue.durationUs)) return [];
    const offsetUs = Math.round(cue.offsetUs);
    const volume = cue.volume;
    const durationUs = Math.round(cue.durationUs);
    if (offsetUs < 0 || offsetUs > 120_000_000 || volume < 0 || volume > 1 || durationUs < 50_000 || durationUs > 3_000_000) return [];
    const sourcePath = typeof cue.sourcePath === "string" && cue.sourcePath.length <= 32_768 ? cue.sourcePath : undefined;
    return [{ soundId: cue.soundId, offsetUs, volume, durationUs, sourcePath }];
  });
}

function normalizeEffectParams(value: unknown, defaults: CompositionParams = {}): CompositionParams {
  const normalized: CompositionParams = { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
  for (const [key, candidate] of Object.entries(value).slice(0, 64)) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/iu.test(key)) continue;
    if (typeof candidate === "string") normalized[key] = candidate.slice(0, 20_000);
    else if (typeof candidate === "boolean") normalized[key] = candidate;
    else if (typeof candidate === "number" && Number.isFinite(candidate)) normalized[key] = Math.max(-1_000_000_000, Math.min(1_000_000_000, candidate));
  }
  return normalized;
}

function defaultEffectParams(compositionId: string): CompositionParams {
  return structuredClone(allCompositions().find((effect) => effect.id === compositionId)?.defaultParams ?? {});
}

const scenePresets: readonly SceneBackgroundSpec["preset"][] = [
  "black-stripes", "white-frame", "dark-grid", "clean-white", "spotlight", "blueprint", "paper-lines", "contrast-side"
];

const chapterProgressPresets: readonly ChapterProgressPreset[] = ["top-dark", "bottom-light", "top-minimal", "bottom-steps", "bottom-labels", "custom"];
const chapterProgressPositions: readonly ChapterProgressPosition[] = ["top", "bottom"];
const chapterProgressStyles: readonly ChapterProgressStyle[] = ["segments", "line", "steps", "labels"];
const motionSkins: readonly MotionSkin[] = ["dark", "light"];
const motionStyles: readonly MotionStyle[] = ["minimal", "editorial"];
const motionFonts: readonly MotionFont[] = ["sans", "display"];
const motionColorRoles: readonly MotionColorRole[] = ["data", "opinion", "warning", "auxiliary", "custom"];
const supportedProjectSchemaVersions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] as const;

function migrateCompositionFields(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record: Record<string, unknown> = { ...value };
  if (record.kind === "effect") record.kind = "composition";
  if (typeof record.effectId === "string") {
    record.compositionId = record.effectId;
    delete record.effectId;
  }
  for (const field of ["tracks", "clips", "scenes", "additionalEffects"]) {
    if (Array.isArray(record[field])) record[field] = record[field].map(migrateCompositionFields);
  }
  return record;
}

function normalizeVideoTransition(value: unknown, durationUs: number): VideoTransition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_VIDEO_TRANSITION };
  const candidate = value as Record<string, unknown>;
  const preset = typeof candidate.preset === "string" && VIDEO_TRANSITION_PRESETS.includes(candidate.preset as VideoTransition["preset"])
    ? candidate.preset as VideoTransition["preset"]
    : DEFAULT_VIDEO_TRANSITION.preset;
  const normalizedDurationUs = typeof candidate.durationUs === "number" && Number.isFinite(candidate.durationUs) && candidate.durationUs > 0
    ? Math.max(50_000, Math.min(durationUs, Math.round(candidate.durationUs)))
    : Math.min(durationUs, DEFAULT_VIDEO_TRANSITION.durationUs);
  const easing = typeof candidate.easing === "string" && isEasingName(candidate.easing)
    ? candidate.easing
    : DEFAULT_VIDEO_TRANSITION.easing;
  const fromClipIdCandidate = typeof candidate.fromClipId === "string" ? candidate.fromClipId.trim() : "";
  const fromClipId = fromClipIdCandidate && fromClipIdCandidate.length <= 256 ? fromClipIdCandidate : undefined;
  return { preset, durationUs: normalizedDurationUs, easing, fromClipId };
}

function isGeneratedOverlayStudioEffect(clip: CompositionClip) {
  return OVERLAY_STUDIO_EFFECT_IDS.includes(clip.compositionId as (typeof OVERLAY_STUDIO_EFFECT_IDS)[number])
    && Boolean(clip.sourceSubtitleId || clip.sourceBlockId || clip.label.startsWith("AI 动效"));
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

function migrateGeneratedOverlayStudioLayout(project: EditorProject, sourceSchemaVersion: number) {
  if (sourceSchemaVersion >= 22) return;
  const effects = project.tracks.flatMap((track) => track.clips).filter((clip): clip is CompositionClip => clip.kind === "composition");
  const movable = effects.filter((effect) => isGeneratedOverlayStudioEffect(effect) && !effect.transformKeyframes?.length);
  if (!movable.length) return;
  const movableIds = new Set(movable.map((effect) => effect.id));
  const occupiedLayers: OccupiedMotionLayoutLayer[] = effects
    .filter((effect) => !movableIds.has(effect.id))
    .map((effect) => ({
      layer: effectMotionLayoutLayer(effect),
      placement: { x: effect.transform.x, y: effect.transform.y, scale: effect.transform.scale }
    }));
  const firstStartUs = Math.min(...movable.map((effect) => effect.startUs));
  const lastEndUs = Math.max(...movable.map((effect) => effect.startUs + effect.durationUs));
  const presenterArea = presenterMotionSafeArea(project.presenterSafeArea, firstStartUs, lastEndUs - firstStartUs);
  const placements = resolveMotionLayout({
    canvas: project.canvas,
    layers: movable.map(effectMotionLayoutLayer),
    safeAreas: presenterArea ? [presenterArea] : [],
    occupiedLayers
  });
  for (const effect of movable) {
    const placement = placements.get(effect.id);
    if (placement) effect.transform = { ...effect.transform, ...placement };
  }
}

function normalizeGeneratedReferenceStageLayout(project: EditorProject) {
  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if (clip.kind !== "composition" || !isGeneratedOverlayStudioEffect(clip) || !isReferenceStageComposition(clip.compositionId) || clip.transformKeyframes?.length) continue;
    clip.transform = referenceStageOuterTransform(clip.transform);
  }
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && /^[a-z0-9-]{1,64}$/iu.test(item)).slice(0, 32);
}

function normalizeOptionalTimeUs(value: unknown, durationUs: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(Math.max(0, durationUs), Math.round(value)));
}

function normalizeClipTime<T extends { startUs: number; durationUs: number }>(clip: T): T {
  return {
    ...clip,
    startUs: Number.isFinite(clip.startUs) ? Math.max(0, Math.round(clip.startUs)) : clip.startUs,
    durationUs: Number.isFinite(clip.durationUs) ? Math.max(1, Math.round(clip.durationUs)) : clip.durationUs
  };
}

function normalizeMotionTheme(value: unknown): MotionTheme {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_MOTION_THEME);
  const candidate = value as Record<string, unknown>;
  const colors = candidate.colors && typeof candidate.colors === "object" ? candidate.colors as Record<string, unknown> : {};
  const color = (field: keyof MotionTheme["colors"]) => chapterProgressColor(colors[field], DEFAULT_MOTION_THEME.colors[field]);
  return {
    skin: typeof candidate.skin === "string" && motionSkins.includes(candidate.skin as MotionSkin) ? candidate.skin as MotionSkin : DEFAULT_MOTION_THEME.skin,
    style: typeof candidate.style === "string" && motionStyles.includes(candidate.style as MotionStyle) ? candidate.style as MotionStyle : DEFAULT_MOTION_THEME.style,
    font: typeof candidate.font === "string" && motionFonts.includes(candidate.font as MotionFont) ? candidate.font as MotionFont : DEFAULT_MOTION_THEME.font,
    colors: {
      text: color("text"),
      surface: color("surface"),
      data: color("data"),
      opinion: color("opinion"),
      warning: color("warning"),
      auxiliary: color("auxiliary")
    }
  };
}

function chapterProgressColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value) ? value : fallback;
}

function normalizeSceneBackground(value: unknown, compositionId: string): SceneBackgroundSpec {
  const fallback = structuredClone(compositionById(compositionId).recipe.sceneBackground ?? compositionById("scene-black-stripes").recipe.sceneBackground!);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  const color = (field: "primaryColor" | "secondaryColor" | "borderColor") => (
    typeof candidate[field] === "string" && /^#[0-9a-f]{6}$/iu.test(candidate[field]) ? candidate[field] : fallback[field]
  );
  return {
    preset: typeof candidate.preset === "string" && scenePresets.includes(candidate.preset as SceneBackgroundSpec["preset"])
      ? candidate.preset as SceneBackgroundSpec["preset"]
      : fallback.preset,
    primaryColor: color("primaryColor"),
    secondaryColor: color("secondaryColor"),
    borderColor: color("borderColor"),
    intensity: typeof candidate.intensity === "number" && Number.isFinite(candidate.intensity)
      ? Math.max(0.1, Math.min(1, candidate.intensity))
      : fallback.intensity
  };
}

export function serializeProject(project: EditorProject): string {
  const snapshot = structuredClone(project);
  for (const asset of snapshot.assets) {
    delete asset.objectUrl;
    delete asset.proxyPath;
    delete asset.proxyObjectUrl;
    delete asset.proxyHeight;
    delete asset.missing;
  }
  return JSON.stringify(snapshot, null, 2);
}

export function parseProject(contents: string): EditorProject {
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch {
    throw new Error("工程文件不是有效的 JSON");
  }
  if (!raw || typeof raw !== "object") throw new Error("工程文件结构无效");
  if ("schemaVersion" in raw && typeof raw.schemaVersion === "number" && raw.schemaVersion <= 24) raw = migrateCompositionFields(raw);
  const candidate = raw as Omit<Partial<EditorProject>, "schemaVersion"> & { schemaVersion?: number };
  const sourceSchemaVersion = candidate.schemaVersion;
  if (typeof sourceSchemaVersion !== "number" || !supportedProjectSchemaVersions.includes(sourceSchemaVersion as (typeof supportedProjectSchemaVersions)[number])) throw new Error("不支持此工程文件版本");
  if (!Array.isArray(candidate.assets) || !Array.isArray(candidate.tracks) || !candidate.canvas) throw new Error("工程文件缺少素材、轨道或画布信息");
  const fallback = createEmptyProject();
  const tracks = candidate.tracks.map((track) => ({
    ...track,
    name: track.kind === "audio" && track.id === "audio-main" && track.name === "音频" ? "背景音乐" : track.name,
    locked: track.locked ?? false,
    muted: track.muted ?? false,
    hidden: track.hidden ?? false,
    audioRole: track.kind === "audio" ? track.audioRole ?? track.clips.find((clip) => clip.kind === "audio")?.role ?? "music" : undefined,
    clips: track.clips.map((clip) => clip.kind === "audio" ? {
      ...clip,
      sourceInUs: clip.sourceInUs ?? 0,
      playbackRate: clip.playbackRate ?? 1,
      volume: clip.volume ?? 1,
      fadeInUs: clip.fadeInUs ?? 0,
      fadeOutUs: clip.fadeOutUs ?? 0,
      role: clip.role ?? "music"
    } : clip.kind === "video" ? { ...clip, camera: clip.camera ?? cameraMotionForPreset("none"), cameraOffsetUs: clip.cameraOffsetUs ?? 0, cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs, zIndex: clip.zIndex, transform: clip.transform ?? { ...DEFAULT_TRANSFORM }, transformKeyframes: clip.transformKeyframes ?? [], layoutPreset: clip.layoutPreset ?? (track.id === "video-main" ? "full" : "picture-in-picture-top-right"), role: clip.role ?? (track.id === "video-main" ? "a-roll" : "b-roll"), mask: { ...DEFAULT_VIDEO_MASK, ...clip.mask }, transition: normalizeVideoTransition(clip.transition, clip.durationUs), focus: clip.focus ? { ...DEFAULT_VIDEO_FOCUS, ...clip.focus } : undefined, presentationCues: (clip.presentationCues ?? []).map((cue) => ({ ...cue, offsetUs: Math.max(0, Math.min(clip.durationUs - 1, cue.offsetUs)), transitionDurationUs: cue.transitionDurationUs <= 0 ? 0 : Math.max(100_000, Math.min(clip.durationUs - cue.offsetUs, cue.transitionDurationUs)), transform: { ...DEFAULT_TRANSFORM, ...cue.transform }, mask: { ...DEFAULT_VIDEO_MASK, ...cue.mask }, focus: { ...DEFAULT_VIDEO_FOCUS, ...cue.focus }, camera: cue.camera ?? cameraMotionForPreset("none"), fit: cue.fit ?? "cover" })).sort((left, right) => left.offsetUs - right.offsetUs) }
      : clip.kind === "scene" ? {
        ...clip,
        opacity: Number.isFinite(clip.opacity) ? Math.max(0, Math.min(1, clip.opacity)) : 1,
        background: normalizeSceneBackground(clip.background, clip.compositionId),
        soundCues: normalizeEffectSoundCues(clip.soundCues),
        dimAtUs: normalizeOptionalTimeUs(clip.dimAtUs, clip.durationUs),
        lintOff: normalizeStringList(clip.lintOff)
      }
      : clip.kind === "composition" ? (() => {
        const recipe = clip.recipe ?? structuredClone(compositionById(clip.compositionId).recipe);
        if (recipe.sceneBackground) {
          return {
            ...clip,
            bindings: normalizeBindings(clip.bindings),
            sourceOffsetUs: normalizeOptionalTimeUs(clip.sourceOffsetUs, Number.MAX_SAFE_INTEGER) ?? 0,
            animationDurationUs: Math.max(1, normalizeOptionalTimeUs(clip.animationDurationUs, Number.MAX_SAFE_INTEGER) ?? clip.durationUs),
            recipe: { ...recipe, sceneBackground: normalizeSceneBackground(recipe.sceneBackground, clip.compositionId) },
            transform: { ...clip.transform, opacity: typeof clip.transform?.opacity === "number" && Number.isFinite(clip.transform.opacity)
              ? Math.max(0, Math.min(1, clip.transform.opacity))
              : 1 },
            soundCues: normalizeEffectSoundCues(clip.soundCues),
            sceneGroupId: clip.sceneGroupId,
            matchQuery: clip.matchQuery,
            dimAtUs: normalizeOptionalTimeUs(clip.dimAtUs, clip.durationUs),
            lintOff: normalizeStringList(clip.lintOff)
          } satisfies CompositionClip;
        }
        const generatedOverlayStudioEffect = sourceSchemaVersion < 22 && isGeneratedOverlayStudioEffect(clip);
        const params = normalizeEffectParams(clip.params, defaultEffectParams(clip.compositionId));
        return {
          ...clip,
          shotcraft: isShotcraftComposition(clip.compositionId) ? normalizeShotcraftSettings(clip.shotcraft, clip.compositionId) : undefined,
          bindings: normalizeBindings(clip.bindings),
          speed: typeof clip.speed === "number" && Number.isFinite(clip.speed) ? Math.max(0.25, Math.min(3, clip.speed)) : 1,
          sourceOffsetUs: normalizeOptionalTimeUs(clip.sourceOffsetUs, Number.MAX_SAFE_INTEGER) ?? 0,
          animationDurationUs: Math.max(1, normalizeOptionalTimeUs(clip.animationDurationUs, Number.MAX_SAFE_INTEGER) ?? clip.durationUs),
          zIndex: clip.zIndex,
          recipe,
          fontSize: generatedOverlayStudioEffect ? OVERLAY_STUDIO_BASE_FONT_SIZE : clip.fontSize,
          transform: generatedOverlayStudioEffect && !clip.transformKeyframes?.length
            ? { ...clip.transform, scale: 1 }
            : clip.transform,
          params: generatedOverlayStudioEffect ? remapEffectTextParams(clip.compositionId, clip.text, params) : params,
          soundCues: normalizeEffectSoundCues(clip.soundCues),
          backdrop: { ...DEFAULT_EFFECT_BACKDROP, ...clip.backdrop },
          colorRole: typeof clip.colorRole === "string" && motionColorRoles.includes(clip.colorRole as MotionColorRole) ? clip.colorRole as MotionColorRole : "custom",
          dimAtUs: normalizeOptionalTimeUs(clip.dimAtUs, clip.durationUs),
          lintOff: normalizeStringList(clip.lintOff)
        };
      })()
      : clip.kind === "subtitle" ? { ...clip, ...DEFAULT_SUBTITLE_STYLE, ...clip, highlightWords: Array.isArray(clip.highlightWords) ? clip.highlightWords.filter((word): word is string => typeof word === "string").slice(0, 8) : [] }
      : clip.kind === "generated" ? { ...clip, scenes: clip.scenes.map((scene) => migrateLegacyGeneratedEffectLayout({
        ...scene,
        textColor: scene.textColor ?? "#ffffff",
        accentColor: scene.accentColor ?? (scene as typeof scene & { color?: string }).color ?? "#ffb84d",
        fontSize: scene.fontSize ?? 58,
        speed: scene.speed ?? 1,
        transform: scene.transform ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
        mediaSourceInUs: scene.mediaSourceInUs ?? 0,
        mediaFit: scene.mediaFit ?? "cover",
        mediaVolume: scene.mediaVolume ?? 0,
        camera: scene.camera ?? cameraMotionForPreset("none"),
        recipe: scene.recipe ?? structuredClone(compositionById(scene.compositionId).recipe),
        additionalEffects: (scene.additionalEffects ?? []).map((layer) => ({
          ...layer,
          startOffsetUs: layer.startOffsetUs ?? 0,
          durationUs: layer.durationUs ?? scene.durationUs,
          zIndex: layer.zIndex ?? 20,
          source: layer.source ?? "manual",
          matchQuery: layer.matchQuery ?? `${scene.title} ${scene.narration}`.trim(),
          recipe: layer.recipe ?? structuredClone(compositionById(layer.compositionId).recipe),
          soundCues: normalizeEffectSoundCues(layer.soundCues)
        })),
        secondaryMediaSourceInUs: scene.secondaryMediaSourceInUs ?? 0,
        secondaryMediaFit: scene.secondaryMediaFit ?? "cover",
        secondaryMediaVolume: scene.secondaryMediaVolume ?? 0,
        mediaLayoutPreset: scene.mediaLayoutPreset ?? "full"
      })) }
      : clip.kind === "image" ? { ...clip, transform: clip.transform ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: clip.entrance ?? "pop", speed: clip.speed ?? 1, transition: normalizeVideoTransition(clip.transition, clip.durationUs) }
        : clip).map(normalizeClipTime)
  })) as EditorProject["tracks"];
  for (const fallbackTrack of fallback.tracks) {
    const exists = fallbackTrack.kind === "audio"
      ? tracks.some((track) => track.kind === "audio" && track.audioRole === fallbackTrack.audioRole)
      : fallbackTrack.kind === "video"
        ? tracks.some((track) => track.kind === "video")
        : tracks.some((track) => track.kind === fallbackTrack.kind);
    if (!exists) tracks.push(structuredClone(fallbackTrack));
  }
  tracks.splice(0, tracks.length, ...migrateSceneTracks(tracks));
  const trackOrder = (track: EditorProject["tracks"][number]) => {
    if (track.kind === "video") return 0;
    if (track.kind === "image") return 1;
    if (track.kind === "generated") return 2;
    if (track.kind === "scene") return 3;
    if (track.kind === "composition") return 4;
    if (track.kind === "subtitle") return 5;
    if (track.audioRole === "voice") return 6;
    if (track.audioRole === "music") return 7;
    return 8;
  };
  tracks.sort((left, right) => trackOrder(left) - trackOrder(right));
  tracks.filter((track) => track.kind === "video").forEach((track) => {
    track.name = "视频";
  });
  const chapterCandidate = candidate.chapterProgress;
  const chapterPreset = typeof chapterCandidate?.preset === "string"
    ? chapterProgressPresets.includes(chapterCandidate.preset as ChapterProgressPreset) ? chapterCandidate.preset as ChapterProgressPreset : "custom"
    : DEFAULT_CHAPTER_PROGRESS.preset;
  const chapterPresetDefinition = CHAPTER_PROGRESS_PRESETS.find((preset) => preset.id === chapterPreset);
  const project = {
    ...fallback,
    ...candidate,
    schemaVersion: 32 as const,
    musicAnalyses: candidate.musicAnalyses === undefined ? undefined : z.array(z.object({ assetId: z.string().min(1).max(256), analysis: musicAnalysisSchema }).strict()).max(16).parse(candidate.musicAnalyses),
    canvas: { ...fallback.canvas, ...candidate.canvas },
    presenterSafeArea: normalizePresenterSafeArea(candidate.presenterSafeArea),
    motionTheme: normalizeMotionTheme(candidate.motionTheme),
    subtitleTheme: normalizeSubtitleTheme(candidate.subtitleTheme),
    chapterProgress: {
      ...DEFAULT_CHAPTER_PROGRESS,
      enabled: typeof chapterCandidate?.enabled === "boolean" ? chapterCandidate.enabled : DEFAULT_CHAPTER_PROGRESS.enabled,
      preset: chapterPreset,
      position: typeof chapterCandidate?.position === "string" && chapterProgressPositions.includes(chapterCandidate.position as ChapterProgressPosition)
        ? chapterCandidate.position as ChapterProgressPosition
        : DEFAULT_CHAPTER_PROGRESS.position,
      style: typeof chapterCandidate?.style === "string" && chapterProgressStyles.includes(chapterCandidate.style as ChapterProgressStyle)
        ? chapterCandidate.style as ChapterProgressStyle
        : DEFAULT_CHAPTER_PROGRESS.style,
      backgroundColor: chapterProgressColor(chapterCandidate?.backgroundColor, DEFAULT_CHAPTER_PROGRESS.backgroundColor),
      backgroundOpacity: typeof chapterCandidate?.backgroundOpacity === "number" && Number.isFinite(chapterCandidate.backgroundOpacity)
        ? Math.max(0, Math.min(1, chapterCandidate.backgroundOpacity))
        : DEFAULT_CHAPTER_PROGRESS.backgroundOpacity,
      activeColor: chapterProgressColor(chapterCandidate?.activeColor, DEFAULT_CHAPTER_PROGRESS.activeColor),
      inactiveColor: chapterProgressColor(chapterCandidate?.inactiveColor, DEFAULT_CHAPTER_PROGRESS.inactiveColor),
      textColor: chapterProgressColor(chapterCandidate?.textColor, DEFAULT_CHAPTER_PROGRESS.textColor),
      height: chapterPresetDefinition?.height ?? (typeof chapterCandidate?.height === "number" && Number.isFinite(chapterCandidate.height)
        ? Math.max(28, Math.min(120, Math.round(chapterCandidate.height)))
        : DEFAULT_CHAPTER_PROGRESS.height),
      showTitles: typeof chapterCandidate?.showTitles === "boolean" ? chapterCandidate.showTitles : DEFAULT_CHAPTER_PROGRESS.showTitles,
      chapters: Array.isArray(chapterCandidate?.chapters)
        ? chapterCandidate.chapters.filter((chapter) => chapter && typeof chapter.title === "string" && Number.isFinite(chapter.startUs)).map((chapter) => ({ ...chapter, startUs: Math.max(0, Math.round(chapter.startUs)), title: chapter.title.trim().slice(0, 24) })).sort((left, right) => left.startUs - right.startUs)
        : []
    },
    assets: candidate.assets,
    tracks
  } as EditorProject;
  if (sourceSchemaVersion <= 25) {
    const usedIds = new Set(project.tracks.flatMap((track) => track.clips).map((clip) => clip.id));
    for (const track of project.tracks) {
      const backgrounds: CompositionClip[] = [];
      for (const clip of track.clips) {
        if (clip.kind !== "composition" || !["poster-wall-3d", "image-duet-3d"].includes(clip.compositionId)) continue;
        const params = clip.params ?? {};
        let id = `${clip.id}-background`;
        while (usedIds.has(id)) id += "-1";
        usedIds.add(id);
        backgrounds.push({
          ...structuredClone(clip), id, compositionId: "background-grid", label: `${clip.label} · 背景`, bindings: [],
          params: { ...defaultEffectParams("background-grid"), grid: true, ...params, layoutCount: Math.max(1, compositionAssetIds(clip).length) },
          transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: clip.transform.opacity },
          soundCues: [], transformKeyframes: [], sceneGroupId: undefined
        });
        clip.params = { ...params };
        delete clip.params.background;
        delete clip.params.gridColor;
        delete clip.params.grid;
      }
      track.clips.push(...backgrounds);
    }
  }
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.kind === "video") {
        clip.zIndex = sourceSchemaVersion < 28
          ? normalizeLayer(DEFAULT_VIDEO_LAYER + (typeof clip.zIndex === "number" && Number.isFinite(clip.zIndex) ? clip.zIndex : track.id === "video-main" ? 0 : 10), DEFAULT_VIDEO_LAYER)
          : normalizeLayer(clip.zIndex, DEFAULT_VIDEO_LAYER);
        clip.mask = normalizeVideoMask(clip.mask);
        for (const cue of clip.presentationCues ?? []) cue.mask = normalizeVideoMask(cue.mask);
      } else if (clip.kind === "composition") {
        if (sourceSchemaVersion < 28) {
          clip.zIndex = isBackgroundComposition(clip.compositionId) || clip.recipe?.sceneBackground ? 0
            : normalizeLayer(200 + (typeof clip.zIndex === "number" && Number.isFinite(clip.zIndex) ? clip.zIndex : 20), 220);
        } else clip.zIndex = compositionLayer(clip);
      }
    }
  }
  migrateGeneratedOverlayStudioLayout(project, sourceSchemaVersion);
  normalizeGeneratedReferenceStageLayout(project);
  const assetById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const generatedById = new Map(project.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "generated")
    .map((clip) => [clip.id, clip]));
  for (const clip of project.tracks.flatMap((track) => track.clips)) {
    if (clip.kind !== "audio" || clip.role !== "voice" || !clip.sourceBlockId || clip.sourceInUs !== 0 || clip.playbackRate !== 1) continue;
    const asset = assetById.get(clip.assetId);
    const block = generatedById.get(clip.sourceBlockId);
    if (!asset || !block || clip.startUs !== block.startUs) continue;
    if (Math.abs(asset.durationUs - block.durationUs) <= 250_000 && Math.abs(clip.durationUs - asset.durationUs) > 250_000) {
      clip.durationUs = asset.durationUs;
    }
  }
  project.updatedAt = new Date().toISOString();
  project.durationUs = projectEndUs(project);
  return project;
}
