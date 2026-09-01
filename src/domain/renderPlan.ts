import { contentEndUs, type AudioClip, type EditorProject, type EffectBackdrop, type EffectClip, type GeneratedBlock, type ImageClip, type SceneClip, type VideoClip } from "@/domain/project";
import type { ExportVideoFormat, RenderAudioClip, RenderFocusOverlay, RenderOverlay, RenderPlan, RenderSegment, VideoEncoder } from "@/services/media";
import { effectById } from "@/domain/effects";
import { DEFAULT_TRANSFORM } from "@/domain/transforms";
import { videoFocus, videoMask, videoPresentationAt, videoTransition } from "@/domain/videoPresentation";
import { displaySubtitleText, subtitleStyle } from "@/domain/videoDecorations";

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number): T | undefined {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

const frameRecipe = { layout: "frame" as const, entrance: "none" as const, paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 };

function transformEasingForRange(clip: VideoClip, startOffsetUs: number, endOffsetUs: number) {
  const activeCue = [...(clip.presentationCues ?? [])].sort((left, right) => right.offsetUs - left.offsetUs).find((cue) => cue.offsetUs <= startOffsetUs);
  if (activeCue) return "ease-in-out" as const;
  return [...(clip.transformKeyframes ?? [])].sort((left, right) => left.offsetUs - right.offsetUs).find((frame) => frame.offsetUs >= endOffsetUs)?.easing ?? "ease-in-out";
}

function transformKeyframesForRange(clip: VideoClip, startOffsetUs: number, endOffsetUs: number) {
  const points = new Set<number>([startOffsetUs, endOffsetUs]);
  for (const frame of clip.transformKeyframes ?? []) {
    if (frame.offsetUs > startOffsetUs && frame.offsetUs < endOffsetUs) points.add(frame.offsetUs);
  }
  for (const cue of clip.presentationCues ?? []) {
    for (const point of [cue.offsetUs, cue.offsetUs + cue.transitionDurationUs]) {
      if (point > startOffsetUs && point < endOffsetUs) points.add(point);
    }
  }
  const offsets = [...points].sort((left, right) => left - right);
  const states = offsets.map((offsetUs) => {
    const instantCueAtRangeEnd = offsetUs === endOffsetUs
      && clip.presentationCues?.some((cue) => cue.offsetUs === endOffsetUs && cue.transitionDurationUs <= 0);
    const sampleOffsetUs = instantCueAtRangeEnd ? Math.max(startOffsetUs, endOffsetUs - 1) : offsetUs;
    return videoPresentationAt(clip, sampleOffsetUs).transform;
  });
  const changed = states.slice(1).some((state, index) => ["x", "y", "scale"].some((field) => Math.abs(state[field as "x" | "y" | "scale"] - states[index][field as "x" | "y" | "scale"]) > 0.000_001));
  if (!changed) return undefined;
  return offsets.map((offsetUs, index) => ({
    offsetUs: offsetUs - startOffsetUs,
    x: states[index].x,
    y: states[index].y,
    scale: states[index].scale,
    easing: index === 0 ? "linear" as const : transformEasingForRange(clip, offsets[index - 1], offsetUs)
  }));
}

function focusOverlay(
  clip: VideoClip,
  focus: ReturnType<typeof videoFocus>,
  startOffsetUs: number,
  durationUs: number,
  zIndex: number
): RenderFocusOverlay {
  const presentation = videoPresentationAt(clip, startOffsetUs);
  return {
    kind: "focus",
    startUs: clip.startUs + startOffsetUs,
    durationUs,
    x: presentation.transform.x,
    y: presentation.transform.y,
    opacity: presentation.transform.opacity,
    scale: presentation.transform.scale,
    rotation: presentation.transform.rotation,
    speed: 1,
    zIndex,
    transformKeyframes: transformKeyframesForRange(clip, startOffsetUs, startOffsetUs + durationUs),
    mask: { ...presentation.mask, borderWidth: 0, focusX: 50, focusY: 50 },
    focus: { ...focus, startOffsetUs: 0 },
    recipe: frameRecipe
  };
}

function dynamicVideoOverlays(clip: VideoClip, path: string): RenderOverlay[] {
  if (!clip.presentationCues?.length) {
    const transform = clip.transform ?? DEFAULT_TRANSFORM;
    const focus = videoFocus(clip);
    const videoOverlay = { kind: "video" as const, startUs: clip.startUs, durationUs: clip.durationUs, path, sourceInUs: clip.sourceInUs, playbackRate: clip.playbackRate, fit: clip.fit, loop: false, camera: clip.camera, cameraOffsetUs: clip.cameraOffsetUs ?? 0, cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs, x: transform.x, y: transform.y, opacity: transform.opacity, scale: transform.scale, rotation: transform.rotation, speed: 1, zIndex: clip.zIndex ?? 0, transformKeyframes: clip.transformKeyframes, mask: videoMask(clip), transition: videoTransition(clip), focus, recipe: frameRecipe };
    if (!focus.enabled) return [videoOverlay];
    const durationUs = Math.min(focus.durationUs, Math.max(100_000, clip.durationUs - focus.startOffsetUs));
    return [videoOverlay, focusOverlay(clip, focus, focus.startOffsetUs, durationUs, (clip.zIndex ?? 0) + 1)];
  }
  const points = new Set<number>([0, clip.durationUs]);
  for (const frame of clip.transformKeyframes ?? []) points.add(Math.max(0, Math.min(clip.durationUs, frame.offsetUs)));
  for (const cue of clip.presentationCues) {
    points.add(Math.max(0, Math.min(clip.durationUs, cue.offsetUs)));
    points.add(Math.max(0, Math.min(clip.durationUs, cue.offsetUs + cue.transitionDurationUs)));
    if (cue.focus.enabled) {
      points.add(Math.max(0, Math.min(clip.durationUs, cue.focus.startOffsetUs)));
      points.add(Math.max(0, Math.min(clip.durationUs, cue.focus.startOffsetUs + cue.focus.durationUs)));
    }
  }
  const ranges = [...points].sort((left, right) => left - right);
  return ranges.slice(0, -1).flatMap((startOffsetUs, index): RenderOverlay[] => {
    const endOffsetUs = ranges[index + 1];
    const durationUs = endOffsetUs - startOffsetUs;
    if (durationUs <= 0) return [];
    const start = videoPresentationAt(clip, startOffsetUs);
    const transformKeyframes = transformKeyframesForRange(clip, startOffsetUs, endOffsetUs);
    const focusStartUs = Math.max(startOffsetUs, start.focus.startOffsetUs);
    const focusEndUs = Math.min(endOffsetUs, start.focus.startOffsetUs + start.focus.durationUs);
    const focusEnabled = start.focus.enabled && focusEndUs > focusStartUs;
    const focus = {
      ...start.focus,
      enabled: focusEnabled,
      startOffsetUs: focusEnabled ? focusStartUs - startOffsetUs : 0,
      durationUs: focusEnabled ? focusEndUs - focusStartUs : 100_000
    };
    const videoOverlay = {
      kind: "video" as const,
      startUs: clip.startUs + startOffsetUs,
      durationUs,
      path,
      sourceInUs: Math.round(clip.sourceInUs + startOffsetUs * clip.playbackRate),
      playbackRate: clip.playbackRate,
      fit: start.fit,
      loop: false,
      camera: start.camera,
      cameraOffsetUs: Math.max(0, startOffsetUs - start.cameraStartOffsetUs),
      cameraDurationUs: start.cameraDurationUs,
      x: start.transform.x,
      y: start.transform.y,
      opacity: start.transform.opacity,
      scale: start.transform.scale,
      rotation: start.transform.rotation,
      speed: 1,
      zIndex: clip.zIndex ?? 0,
      transformKeyframes,
      mask: start.mask,
      transition: { ...videoTransition(clip), preset: "none" as const },
      focus,
      recipe: frameRecipe
    };
    if (!focus.enabled) return [videoOverlay];
    return [videoOverlay, focusOverlay(clip, focus, startOffsetUs + focus.startOffsetUs, focus.durationUs, (clip.zIndex ?? 0) + 1)];
  });
}

export function buildRenderPlan(project: EditorProject, outputPath: string, options: { encoder?: "auto" | VideoEncoder; format?: ExportVideoFormat; width?: number; height?: number; fps?: number } = {}): RenderPlan {
  const width = options.width ?? project.canvas.width;
  const height = options.height ?? project.canvas.height;
  const outputScale = Math.min(width / project.canvas.width, height / project.canvas.height);
  const scaleRecipe = <T extends ReturnType<typeof effectById>["recipe"]>(recipe: T): T => ({
    ...recipe,
    paddingX: recipe.paddingX * outputScale,
    paddingY: recipe.paddingY * outputScale,
    borderWidth: recipe.borderWidth * outputScale,
    borderRadius: recipe.borderRadius * outputScale
  });
  const scaleBackdrop = (backdrop: EffectBackdrop | undefined) => backdrop ? {
    ...backdrop,
    blur: backdrop.blur * outputScale,
    paddingX: backdrop.paddingX * outputScale,
    paddingY: backdrop.paddingY * outputScale,
    radius: backdrop.radius * outputScale
  } : undefined;
  const videoTracks = project.tracks.filter((track) => track.kind === "video" && !track.hidden);
  const videoClips = videoTracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video");
  const generated = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips).filter((clip): clip is GeneratedBlock => clip.kind === "generated");
  const endUs = contentEndUs(project);
  const cuts = new Set<number>([0, endUs]);
  for (const clip of [...videoClips, ...generated]) {
    cuts.add(Math.max(0, clip.startUs));
    cuts.add(Math.min(endUs, clip.startUs + clip.durationUs));
  }
  const points = [...cuts].filter((point) => point >= 0 && point <= endUs).sort((left, right) => left - right);
  const segments: RenderSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const startUs = points[index];
    const durationUs = points[index + 1] - startUs;
    if (durationUs <= 0) continue;
    const block = activeAt(generated, startUs);
    if (block) {
      segments.push({ kind: "generated", durationUs, color: "#171a1e", title: "" });
    } else {
      segments.push({ kind: "gap", durationUs, color: "#171a1e" });
    }
  }
  const visualOverlays: RenderOverlay[] = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips).flatMap<RenderOverlay>((clip): RenderOverlay[] => {
    if (clip.kind === "video") {
      const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
      if (!asset?.sourcePath) throw new Error(`视频图层“${clip.label}”缺少本地源路径，无法导出`);
      return dynamicVideoOverlays(clip, asset.sourcePath);
    }
    if (clip.kind === "scene") {
      const recipe = scaleRecipe({ ...effectById(clip.effectId).recipe, sceneBackground: clip.background });
      return [{ kind: "scene" as const, startUs: clip.startUs, durationUs: clip.durationUs, x: 50, y: 50, opacity: clip.opacity, scale: 1, rotation: 0, speed: 1, zIndex: -100, recipe }];
    }
    if (clip.kind === "effect") {
      const recipe = scaleRecipe(clip.recipe ?? effectById(clip.effectId).recipe);
      return [{ kind: "text" as const, startUs: clip.startUs, durationUs: clip.durationUs, text: clip.text, color: clip.color, accentColor: clip.accentColor, fontSize: clip.fontSize * outputScale, x: clip.transform.x, y: clip.transform.y, opacity: clip.transform.opacity, scale: clip.transform.scale, rotation: clip.transform.rotation, speed: clip.speed, zIndex: 200 + (clip.zIndex ?? 20), transformKeyframes: clip.transformKeyframes, recipe, backdrop: scaleBackdrop(clip.backdrop) }];
    }
    if (clip.kind === "subtitle") {
      const style = subtitleStyle(clip);
      return [{
        kind: "text" as const,
        startUs: clip.startUs,
        durationUs: clip.durationUs,
        text: displaySubtitleText(clip.text),
        color: clip.color,
        accentColor: clip.backgroundColor,
        fontSize: clip.fontSize * outputScale,
        x: 50,
        y: clip.positionY,
        opacity: 1,
        scale: 1,
        rotation: 0,
        speed: 1,
        zIndex: 400,
        subtitleStyle: {
          preset: style.stylePreset,
          highlightWords: style.highlightWords,
          highlightColor: style.highlightColor,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth * outputScale,
          backgroundOpacity: style.backgroundOpacity,
          borderRadius: style.borderRadius * outputScale
        },
        recipe: {
          layout: "frame" as const,
          entrance: "fade-up" as const,
          paddingX: (style.stylePreset === "minimal" ? 6 : 14) * outputScale,
          paddingY: (style.stylePreset === "minimal" ? 3 : 7) * outputScale,
          borderWidth: 0,
          borderRadius: style.borderRadius * outputScale,
          backgroundOpacity: style.stylePreset === "minimal" ? 0 : style.backgroundOpacity
        }
      }];
    }
    if (clip.kind === "image") {
      const image = clip as ImageClip;
      const asset = project.assets.find((candidate) => candidate.id === image.assetId);
      if (!asset?.sourcePath) throw new Error(`贴图“${image.label}”缺少本地源路径，无法导出`);
      return [{ kind: "image" as const, startUs: image.startUs, durationUs: image.durationUs, imagePath: asset.sourcePath, targetWidthPx: Math.max(8, Math.round(width * 0.3 * image.transform.scale)), x: image.transform.x, y: image.transform.y, opacity: image.transform.opacity, scale: image.transform.scale, rotation: image.transform.rotation, speed: image.speed, zIndex: 150, recipe: { layout: "frame" as const, entrance: image.entrance, paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 } }];
    }
    return [];
  });
  if (project.chapterProgress.enabled && project.chapterProgress.chapters.length > 0 && endUs > 0) {
    const chapters = [...project.chapterProgress.chapters].sort((left, right) => left.startUs - right.startUs);
    chapters.filter((chapter) => chapter.startUs < endUs).forEach((chapter) => {
      const chapterIndex = chapters.findIndex((candidate) => candidate.id === chapter.id);
      const startUs = Math.max(0, chapter.startUs);
      const chapterEndUs = Math.min(endUs, chapters[chapterIndex + 1]?.startUs ?? endUs);
      if (chapterEndUs <= startUs) return;
      const progressHeight = Math.max(28, project.chapterProgress.height * outputScale);
      visualOverlays.push({
        kind: "progress",
        startUs,
        durationUs: chapterEndUs - startUs,
        x: 50,
        y: progressHeight / 2 / height * 100,
        opacity: 1,
        scale: 1,
        rotation: 0,
        speed: 1,
        zIndex: 500,
        recipe: frameRecipe,
        chapters,
        chapterIndex,
        backgroundColor: project.chapterProgress.backgroundColor,
        activeColor: project.chapterProgress.activeColor,
        textColor: project.chapterProgress.textColor,
        heightPx: progressHeight
      });
    });
  }
  const overlays = visualOverlays.sort((left, right) => left.zIndex - right.zIndex);
  const audios: RenderAudioClip[] = project.tracks.filter((track) => track.kind === "audio" && !track.hidden && !track.muted).flatMap((track) => track.clips).flatMap((clip) => {
    if (clip.kind !== "audio") return [];
    const audio = clip as AudioClip;
    const asset = project.assets.find((candidate) => candidate.id === audio.assetId);
    if (!asset?.sourcePath) throw new Error(`音频素材“${audio.label}”缺少本地源路径，无法导出`);
    return [{
      path: asset.sourcePath,
      startUs: audio.startUs,
      durationUs: audio.durationUs,
      sourceInUs: audio.sourceInUs,
      playbackRate: audio.playbackRate,
      volume: audio.volume,
      fadeInUs: Math.min(audio.fadeInUs, audio.durationUs),
      fadeOutUs: Math.min(audio.fadeOutUs, audio.durationUs),
      role: audio.role
    }];
  });
  const cueClips = project.tracks
    .filter((track) => (track.kind === "scene" || track.kind === "effect") && !track.hidden && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip): clip is SceneClip | EffectClip => clip.kind === "scene" || clip.kind === "effect");
  for (const clip of cueClips) {
    for (const cue of clip.soundCues ?? []) {
      if (!cue.sourcePath) throw new Error(`${clip.kind === "scene" ? "场景" : "动效"}“${clip.label}”的音效缺少本地缓存，无法导出`);
      const startUs = clip.startUs + cue.offsetUs;
      const durationUs = Math.min(cue.durationUs, clip.startUs + clip.durationUs - startUs);
      if (durationUs <= 0) continue;
      audios.push({
        path: cue.sourcePath,
        startUs,
        durationUs,
        sourceInUs: 0,
        playbackRate: 1,
        volume: cue.volume,
        fadeInUs: 0,
        fadeOutUs: 0,
        role: "sound"
      });
    }
  }
  for (const track of videoTracks.filter((candidate) => !candidate.muted)) {
    for (const clip of track.clips) {
      if (clip.kind !== "video" || clip.volume <= 0) continue;
      const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
      if (!asset?.sourcePath || !asset.hasAudio) continue;
      audios.push({ path: asset.sourcePath, startUs: clip.startUs, durationUs: clip.durationUs, sourceInUs: clip.sourceInUs, playbackRate: clip.playbackRate, volume: clip.volume, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
    }
  }
  return {
    width,
    height,
    fps: options.fps ?? project.canvas.fpsNumerator / project.canvas.fpsDenominator,
    format: options.format ?? "mp4",
    outputPath,
    encoder: options.encoder ?? "auto",
    segments,
    overlays,
    audios
  };
}
