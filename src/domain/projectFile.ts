import { createEmptyProject, DEFAULT_MOTION_THEME, projectEndUs, type ChapterProgressPosition, type ChapterProgressPreset, type ChapterProgressStyle, type EditorProject, type MotionColorRole, type MotionFont, type MotionSkin, type MotionStyle, type MotionTheme, type SceneClip } from "@/domain/project";
import { effectById, type EffectSoundCue, type SceneBackgroundSpec } from "@/domain/effects";
import { cameraMotionForPreset } from "@/domain/camera";
import { DEFAULT_TRANSFORM } from "@/domain/transforms";
import { migrateLegacyGeneratedEffectLayout } from "@/domain/sceneEffects";
import { DEFAULT_EFFECT_BACKDROP, DEFAULT_VIDEO_FOCUS, DEFAULT_VIDEO_MASK, DEFAULT_VIDEO_TRANSITION } from "@/domain/videoPresentation";
import { CHAPTER_PROGRESS_PRESETS, DEFAULT_CHAPTER_PROGRESS, DEFAULT_SUBTITLE_STYLE } from "@/domain/videoDecorations";

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

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && /^[a-z0-9-]{1,64}$/iu.test(item)).slice(0, 32);
}

function normalizeOptionalTimeUs(value: unknown, durationUs: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(Math.max(0, durationUs), Math.round(value)));
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

function normalizeSceneBackground(value: unknown, effectId: string): SceneBackgroundSpec {
  const fallback = structuredClone(effectById(effectId).recipe.sceneBackground ?? effectById("scene-black-stripes").recipe.sceneBackground!);
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
  const candidate = raw as Omit<Partial<EditorProject>, "schemaVersion"> & { schemaVersion?: number };
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(candidate.schemaVersion ?? -1)) throw new Error("不支持此工程文件版本");
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
    } : clip.kind === "video" ? { ...clip, camera: clip.camera ?? cameraMotionForPreset("none"), cameraOffsetUs: clip.cameraOffsetUs ?? 0, cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs, zIndex: clip.zIndex ?? (track.id === "video-main" ? 0 : 10), transform: clip.transform ?? { ...DEFAULT_TRANSFORM }, transformKeyframes: clip.transformKeyframes ?? [], layoutPreset: clip.layoutPreset ?? (track.id === "video-main" ? "full" : "picture-in-picture-top-right"), role: clip.role ?? (track.id === "video-main" ? "a-roll" : "b-roll"), mask: { ...DEFAULT_VIDEO_MASK, ...clip.mask }, transition: { ...DEFAULT_VIDEO_TRANSITION, ...clip.transition }, focus: clip.focus ? { ...DEFAULT_VIDEO_FOCUS, ...clip.focus } : undefined, presentationCues: (clip.presentationCues ?? []).map((cue) => ({ ...cue, offsetUs: Math.max(0, Math.min(clip.durationUs - 1, cue.offsetUs)), transitionDurationUs: cue.transitionDurationUs <= 0 ? 0 : Math.max(100_000, Math.min(clip.durationUs - cue.offsetUs, cue.transitionDurationUs)), transform: { ...DEFAULT_TRANSFORM, ...cue.transform }, mask: { ...DEFAULT_VIDEO_MASK, ...cue.mask }, focus: { ...DEFAULT_VIDEO_FOCUS, ...cue.focus }, camera: cue.camera ?? cameraMotionForPreset("none"), fit: cue.fit ?? "cover" })).sort((left, right) => left.offsetUs - right.offsetUs) }
      : clip.kind === "scene" ? {
        ...clip,
        opacity: Number.isFinite(clip.opacity) ? Math.max(0, Math.min(1, clip.opacity)) : 1,
        background: normalizeSceneBackground(clip.background, clip.effectId),
        soundCues: normalizeEffectSoundCues(clip.soundCues),
        dimAtUs: normalizeOptionalTimeUs(clip.dimAtUs, clip.durationUs),
        lintOff: normalizeStringList(clip.lintOff)
      }
      : clip.kind === "effect" ? (() => {
        const recipe = clip.recipe ?? structuredClone(effectById(clip.effectId).recipe);
        if (recipe.sceneBackground) {
          return {
            id: clip.id,
            trackId: "scene-main",
            kind: "scene" as const,
            label: clip.label,
            startUs: clip.startUs,
            durationUs: clip.durationUs,
            locked: clip.locked,
            sourceBlockId: clip.sourceBlockId,
            sourceSubtitleId: clip.sourceSubtitleId,
            effectId: clip.effectId,
            background: normalizeSceneBackground(recipe.sceneBackground, clip.effectId),
            opacity: typeof clip.transform?.opacity === "number" && Number.isFinite(clip.transform.opacity)
              ? Math.max(0, Math.min(1, clip.transform.opacity))
              : 1,
            soundCues: normalizeEffectSoundCues(clip.soundCues),
            sceneGroupId: clip.sceneGroupId,
            matchQuery: clip.matchQuery,
            dimAtUs: normalizeOptionalTimeUs(clip.dimAtUs, clip.durationUs),
            lintOff: normalizeStringList(clip.lintOff)
          } satisfies SceneClip;
        }
        return {
          ...clip,
          zIndex: clip.zIndex ?? 20,
          recipe,
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
        recipe: scene.recipe ?? structuredClone(effectById(scene.effectId).recipe),
        additionalEffects: (scene.additionalEffects ?? []).map((layer) => ({
          ...layer,
          startOffsetUs: layer.startOffsetUs ?? 0,
          durationUs: layer.durationUs ?? scene.durationUs,
          zIndex: layer.zIndex ?? 20,
          source: layer.source ?? "manual",
          matchQuery: layer.matchQuery ?? `${scene.title} ${scene.narration}`.trim(),
          recipe: layer.recipe ?? structuredClone(effectById(layer.effectId).recipe),
          soundCues: normalizeEffectSoundCues(layer.soundCues)
        })),
        secondaryMediaSourceInUs: scene.secondaryMediaSourceInUs ?? 0,
        secondaryMediaFit: scene.secondaryMediaFit ?? "cover",
        secondaryMediaVolume: scene.secondaryMediaVolume ?? 0,
        mediaLayoutPreset: scene.mediaLayoutPreset ?? "full"
      })) }
      : clip.kind === "image" ? { ...clip, transform: clip.transform ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: clip.entrance ?? "pop", speed: clip.speed ?? 1 }
        : clip)
  })) as EditorProject["tracks"];
  for (const fallbackTrack of fallback.tracks) {
    const exists = fallbackTrack.kind === "audio"
      ? tracks.some((track) => track.kind === "audio" && track.audioRole === fallbackTrack.audioRole)
      : fallbackTrack.kind === "video"
        ? tracks.some((track) => track.kind === "video")
        : tracks.some((track) => track.kind === fallbackTrack.kind);
    if (!exists) tracks.push(structuredClone(fallbackTrack));
  }
  const sceneTrack = tracks.find((track) => track.kind === "scene")!;
  for (const track of tracks) {
    if (track === sceneTrack) continue;
    const scenes = track.clips.filter((clip): clip is SceneClip => clip.kind === "scene");
    track.clips = track.clips.filter((clip) => clip.kind !== "scene");
    for (const scene of scenes) sceneTrack.clips.push({ ...scene, trackId: sceneTrack.id });
  }
  sceneTrack.clips = sceneTrack.clips.map((clip) => ({ ...clip, trackId: sceneTrack.id }));
  const trackOrder = (track: EditorProject["tracks"][number]) => {
    if (track.kind === "video") return 0;
    if (track.kind === "image") return 1;
    if (track.kind === "generated") return 2;
    if (track.kind === "scene") return 3;
    if (track.kind === "effect") return 4;
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
    schemaVersion: 20 as const,
    canvas: { ...fallback.canvas, ...candidate.canvas },
    motionTheme: normalizeMotionTheme(candidate.motionTheme),
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
