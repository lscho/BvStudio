import { isShotcraftComposition, shotcraftOwnsSubtitle, shotcraftRenderData } from "@/domain/shotcraft";
import { contentEndUs, type AudioClip, type EditorProject, type EffectBackdrop, type CompositionClip, type GeneratedBlock, type ImageClip, type SceneClip, type VideoClip, type VideoTransition } from "@/domain/project";
import { compositionAssetIds, compositionBindingIssues, compositionLayer, mediaComposition } from "@/domain/compositions";
import type { ExportVideoFormat, RenderAudioClip, RenderFocusOverlay, RenderOverlay, RenderPlan, RenderSegment, VideoEncoder } from "@/services/media";
import { clockControlledRecipe, compositionById, effectiveEffectFontSize } from "@/domain/effects";
import { DEFAULT_TRANSFORM } from "@/domain/transforms";
import { momentumExitTransition, videoFocus, videoMask, videoPresentationAt, videoTransition, visualTransition, type VisualTransitionClip } from "@/domain/videoPresentation";
import { displaySubtitleText, subtitleStyle } from "@/domain/videoDecorations";
import { resolveEffectAppearance } from "@/domain/motionTheme";
import { focusCardSourceRect } from "@/domain/focusCard";
import { DEFAULT_VIDEO_LAYER, normalizeLayer } from "@/domain/layers";
import { videoFrameMask, videoFrameSize } from "@/domain/videoFrame";
import { overlayStudioMediaSlots } from "@/domain/overlayStudioMedia";
import { isReferenceStageComposition, referenceStageOuterTransform } from "@/domain/overlayStudioReference";

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number): T | undefined {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

interface TimelineRange { startUs: number; durationUs: number }

function subtractTimelineRanges(range: TimelineRange, blockers: readonly TimelineRange[]) {
  let visible = [range];
  for (const blocker of blockers) {
    const blockerEndUs = blocker.startUs + blocker.durationUs;
    visible = visible.flatMap((candidate) => {
      const candidateEndUs = candidate.startUs + candidate.durationUs;
      const overlapStartUs = Math.max(candidate.startUs, blocker.startUs);
      const overlapEndUs = Math.min(candidateEndUs, blockerEndUs);
      if (overlapEndUs <= overlapStartUs) return [candidate];
      return [
        ...(overlapStartUs > candidate.startUs ? [{ startUs: candidate.startUs, durationUs: overlapStartUs - candidate.startUs }] : []),
        ...(overlapEndUs < candidateEndUs ? [{ startUs: overlapEndUs, durationUs: candidateEndUs - overlapEndUs }] : [])
      ];
    });
  }
  return visible;
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
  zIndex: number,
  frame: VideoFrameContext,
  transition?: VideoTransition,
  exitTransition?: VideoTransition
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
    mask: { ...videoFrameMask(presentation.mask, frame.canvasWidth, frame.canvasHeight, frame.sourceWidth, frame.sourceHeight), borderWidth: 0, focusX: 50, focusY: 50 },
    focus: { ...focus, startOffsetUs: 0 },
    transition,
    exitTransition,
    recipe: frameRecipe
  };
}

interface TimelineRange {
  startUs: number;
  durationUs: number;
}

interface VideoFrameContext {
  canvasWidth: number;
  canvasHeight: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

function dynamicVideoOverlays(clip: VideoClip, path: string, frame: VideoFrameContext, exitTransition?: VideoTransition, excludedRanges: TimelineRange[] = []): RenderOverlay[] {
  const transition = videoTransition(clip);
  const momentumEntering = transition.preset === "momentum-zoom";
  const momentumExiting = exitTransition?.preset === "momentum-zoom";
  if (!clip.presentationCues?.length && !momentumEntering && !momentumExiting && excludedRanges.length === 0) {
    const transform = clip.transform ?? DEFAULT_TRANSFORM;
    const focus = videoFocus(clip);
    const videoOverlay = { kind: "video" as const, startUs: clip.startUs, durationUs: clip.durationUs, path, sourceInUs: clip.sourceInUs, playbackRate: clip.playbackRate, fit: clip.fit, loop: false, camera: clip.camera, cameraOffsetUs: clip.cameraOffsetUs ?? 0, cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs, x: transform.x, y: transform.y, opacity: transform.opacity, scale: transform.scale, rotation: transform.rotation, speed: 1, zIndex: normalizeLayer(clip.zIndex, DEFAULT_VIDEO_LAYER), transformKeyframes: clip.transformKeyframes, mask: videoFrameMask(videoMask(clip), frame.canvasWidth, frame.canvasHeight, frame.sourceWidth, frame.sourceHeight), transition: videoTransition(clip), focus, recipe: frameRecipe };
    if (!focus.enabled) return [videoOverlay];
    const durationUs = Math.min(focus.durationUs, Math.max(100_000, clip.durationUs - focus.startOffsetUs));
    return [videoOverlay, focusOverlay(clip, focus, focus.startOffsetUs, durationUs, (normalizeLayer(clip.zIndex, DEFAULT_VIDEO_LAYER)) + 1, frame)];
  }
  const points = new Set<number>([0, clip.durationUs]);
  for (const range of excludedRanges) {
    points.add(Math.max(0, Math.min(clip.durationUs, range.startUs - clip.startUs)));
    points.add(Math.max(0, Math.min(clip.durationUs, range.startUs + range.durationUs - clip.startUs)));
  }
  if (momentumEntering) points.add(Math.min(clip.durationUs, transition.durationUs));
  if (momentumExiting) points.add(Math.max(0, clip.durationUs - exitTransition.durationUs));
  for (const frame of clip.transformKeyframes ?? []) points.add(Math.max(0, Math.min(clip.durationUs, frame.offsetUs)));
  const baseFocus = videoFocus(clip);
  if (baseFocus.enabled) {
    points.add(Math.max(0, Math.min(clip.durationUs, baseFocus.startOffsetUs)));
    points.add(Math.max(0, Math.min(clip.durationUs, baseFocus.startOffsetUs + baseFocus.durationUs)));
  }
  for (const cue of clip.presentationCues ?? []) {
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
    const absoluteStartUs = clip.startUs + startOffsetUs;
    if (excludedRanges.some((range) => absoluteStartUs >= range.startUs && absoluteStartUs < range.startUs + range.durationUs)) return [];
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
      zIndex: normalizeLayer(clip.zIndex, DEFAULT_VIDEO_LAYER),
      transformKeyframes,
      mask: videoFrameMask(start.mask, frame.canvasWidth, frame.canvasHeight, frame.sourceWidth, frame.sourceHeight),
      transition: startOffsetUs === 0 && (momentumEntering || !clip.presentationCues?.length)
        ? { ...transition, durationUs: Math.min(transition.durationUs, durationUs) }
        : { ...transition, preset: "none" as const },
      exitTransition: momentumExiting && endOffsetUs === clip.durationUs
        ? { ...exitTransition, durationUs: Math.min(exitTransition.durationUs, durationUs) }
        : undefined,
      focus,
      recipe: frameRecipe
    };
    if (!focus.enabled) return [videoOverlay];
    return [videoOverlay, focusOverlay(clip, focus, startOffsetUs + focus.startOffsetUs, focus.durationUs, (normalizeLayer(clip.zIndex, DEFAULT_VIDEO_LAYER)) + 1, frame, videoOverlay.transition, videoOverlay.exitTransition)];
  });
}

function dynamicImageOverlays(clip: ImageClip, imagePath: string, targetWidthPx: number, exitTransition?: VideoTransition): RenderOverlay[] {
  const transition = visualTransition(clip);
  const momentumEntering = transition.preset === "momentum-zoom";
  const momentumExiting = exitTransition?.preset === "momentum-zoom";
  const points = new Set<number>([0, clip.durationUs]);
  if (momentumEntering) points.add(Math.min(clip.durationUs, transition.durationUs));
  if (momentumExiting) points.add(Math.max(0, clip.durationUs - exitTransition.durationUs));
  const ranges = [...points].sort((left, right) => left - right);
  return ranges.slice(0, -1).flatMap((startOffsetUs, index): RenderOverlay[] => {
    const endOffsetUs = ranges[index + 1];
    const durationUs = endOffsetUs - startOffsetUs;
    if (durationUs <= 0) return [];
    const incomingTransition = startOffsetUs === 0
      ? { ...transition, durationUs: Math.min(transition.durationUs, durationUs) }
      : { ...transition, preset: "none" as const };
    return [{
      kind: "image" as const,
      startUs: clip.startUs + startOffsetUs,
      durationUs,
      imagePath,
      targetWidthPx,
      x: clip.transform.x,
      y: clip.transform.y,
      opacity: clip.transform.opacity,
      scale: clip.transform.scale,
      rotation: clip.transform.rotation,
      speed: clip.speed,
      zIndex: 150,
      transition: incomingTransition,
      exitTransition: momentumExiting && endOffsetUs === clip.durationUs
        ? { ...exitTransition, durationUs: Math.min(exitTransition.durationUs, durationUs) }
        : undefined,
      recipe: {
        ...frameRecipe,
        entrance: startOffsetUs === 0 && transition.preset === "none" ? clip.entrance : "none"
      }
    }];
  });
}

export function buildRenderPlan(project: EditorProject, outputPath: string, options: { encoder?: "auto" | VideoEncoder; format?: ExportVideoFormat; width?: number; height?: number; fps?: number } = {}): RenderPlan {
  const width = options.width ?? project.canvas.width;
  const height = options.height ?? project.canvas.height;
  const outputScale = Math.min(width / project.canvas.width, height / project.canvas.height);
  const scaleRecipe = <T extends ReturnType<typeof compositionById>["recipe"]>(recipe: T): T => ({
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
  const focusCards = project.tracks.filter((track) => track.kind === "composition" && !track.hidden).flatMap((track) => track.clips).filter((clip): clip is CompositionClip => clip.kind === "composition" && clip.compositionId === "focus-card");
  const shotcraftSubtitleTakeovers = project.tracks.filter((track) => track.kind === "composition" && !track.hidden).flatMap((track) => track.clips).filter((clip): clip is CompositionClip => clip.kind === "composition" && isShotcraftComposition(clip.compositionId) && shotcraftOwnsSubtitle(clip)).map((clip) => ({ startUs: clip.startUs, durationUs: clip.durationUs }));
  const focusCardSourceVideo = (effect: CompositionClip) => {
    const assetId = compositionAssetIds(effect)[0];
    return videoClips.find((candidate) => candidate.assetId === assetId && effect.startUs >= candidate.startUs && effect.startUs < candidate.startUs + candidate.durationUs);
  };
  const focusCardTakeovers = (video: VideoClip) => focusCards.filter((effect) => focusCardSourceVideo(effect)?.id === video.id).map((effect) => ({
    startUs: Math.max(video.startUs, effect.startUs),
    durationUs: Math.max(0, Math.min(video.startUs + video.durationUs, effect.startUs + effect.durationUs) - Math.max(video.startUs, effect.startUs))
  })).filter((range) => range.durationUs > 0);
  const imageClips = project.tracks.filter((track) => track.kind === "image" && !track.hidden).flatMap((track) => track.clips).filter((clip): clip is ImageClip => clip.kind === "image");
  const visualClips: VisualTransitionClip[] = [...videoClips, ...imageClips];
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
      return dynamicVideoOverlays(clip, asset.sourcePath, { canvasWidth: width, canvasHeight: height, sourceWidth: asset.width, sourceHeight: asset.height }, momentumExitTransition(clip, visualClips), focusCardTakeovers(clip));
    }
    if (clip.kind === "scene" || (clip.kind === "composition" && clip.recipe?.sceneBackground)) {
      const recipe = scaleRecipe({ ...compositionById(clip.compositionId).recipe, sceneBackground: clip.kind === "scene" ? clip.background : clip.recipe?.sceneBackground });
      const opacity = clip.kind === "scene" ? clip.opacity : clip.transform.opacity;
      const zIndex = clip.kind === "scene" ? 0 : compositionLayer(clip);
      const dimAtUs = clip.dimAtUs === undefined ? undefined : Math.max(0, Math.min(clip.durationUs, clip.dimAtUs));
      if (dimAtUs === undefined || dimAtUs >= clip.durationUs) return [{ kind: "scene" as const, startUs: clip.startUs, durationUs: clip.durationUs, x: 50, y: 50, opacity, scale: 1, rotation: 0, speed: 1, zIndex, recipe }];
      return [
        ...(dimAtUs > 0 ? [{ kind: "scene" as const, startUs: clip.startUs, durationUs: dimAtUs, x: 50, y: 50, opacity, scale: 1, rotation: 0, speed: 1, zIndex, recipe }] : []),
        { kind: "scene" as const, startUs: clip.startUs + dimAtUs, durationUs: clip.durationUs - dimAtUs, x: 50, y: 50, opacity: opacity * 0.35, scale: 1, rotation: 0, speed: 1, zIndex, recipe }
      ];
    }
    if (clip.kind === "composition") {
      if (isShotcraftComposition(clip.compositionId)) {
        const data = shotcraftRenderData(project, clip);
        const shots = [clip, ...(data.previous ? [data.previous] : [])];
        for (const shot of shots) {
          const issues = compositionBindingIssues(shot, project.assets);
          if (issues.length) throw new Error(`${shot.label}：${issues[0]}`);
        }
        const images = [...new Set(shots.flatMap(compositionAssetIds))].map((id) => {
          const asset = project.assets.find((candidate) => candidate.id === id);
          if (!asset || asset.missing) throw new Error(`${clip.label}素材缺失，请重新定位或替换`);
          if (!asset.sourcePath) throw new Error(`${clip.label}素材缺少本地源路径，无法导出`);
          return { id, path: asset.sourcePath, kind: "image" as const, width: asset.width, height: asset.height };
        });
        return [{ kind: "composition", renderer: "react", compositionId: clip.compositionId, shotcraftData: data,
          compositionImages: images, motionTheme: project.motionTheme,
          startUs: clip.startUs, durationUs: clip.durationUs, sourceOffsetUs: clip.sourceOffsetUs ?? 0,
          animationDurationUs: clip.animationDurationUs, params: clip.params,
          text: clip.text, color: clip.color, accentColor: clip.accentColor, fontSize: clip.fontSize,
          ...clip.transform, transformKeyframes: clip.transformKeyframes, speed: clip.speed, dimAtUs: clip.dimAtUs,
          zIndex: compositionLayer(clip), recipe: frameRecipe }];
      }
      const mediaDefinition = mediaComposition(clip.compositionId);
      if (mediaDefinition) {
        const issues = compositionBindingIssues(clip, project.assets);
        if (issues.length) throw new Error(`${clip.label}：${issues[0]}`);
        const images = compositionAssetIds(clip).map((id) => {
          const asset = project.assets.find((candidate) => candidate.id === id);
          if (!asset?.sourcePath) throw new Error(`${clip.label}素材缺少本地源路径，无法导出`);
          return { id, path: asset.sourcePath, kind: asset.kind === "video" ? "video" as const : "image" as const };
        });
        return [{ kind: "composition", renderer: mediaDefinition.renderer === "canvas" ? "canvas" : "three", compositionId: clip.compositionId, compositionImages: images,
          startUs: clip.startUs, durationUs: clip.durationUs, sourceOffsetUs: clip.sourceOffsetUs ?? 0,
          animationDurationUs: clip.animationDurationUs ?? clip.durationUs, params: clip.params,
          text: "", color: clip.color, accentColor: clip.accentColor, fontSize: clip.fontSize,
          ...clip.transform, transformKeyframes: clip.transformKeyframes, speed: clip.speed,
          zIndex: compositionLayer(clip), recipe: frameRecipe }];
      }
      const recipe = scaleRecipe(clockControlledRecipe(clip.recipe ?? compositionById(clip.compositionId).recipe));
      const fontSize = effectiveEffectFontSize(clip.fontSize, recipe, clip.text);
      const appearance = resolveEffectAppearance(clip, project.motionTheme);
      const referenceSlots = overlayStudioMediaSlots(clip.compositionId);
      const referenceImages = referenceSlots.length ? compositionAssetIds(clip).map((id) => {
        const asset = project.assets.find((candidate) => candidate.id === id);
        if (!asset || asset.missing) throw new Error(`${clip.label}素材缺失，请重新定位或替换`);
        if (!asset.sourcePath) throw new Error(`${clip.label}素材缺少本地源路径，无法导出`);
        if (asset.kind === "audio") throw new Error(`${clip.label}素材类型不符合动效要求`);
        return { id, path: asset.sourcePath, kind: asset.kind };
      }) : undefined;
      if (referenceSlots.length) {
        const issues = compositionBindingIssues(clip, project.assets);
        if (issues.length) throw new Error(`${clip.label}：${issues[0]}`);
      }
      const referenceStage = isReferenceStageComposition(clip.compositionId);
      const transform = referenceStage ? referenceStageOuterTransform(clip.transform) : clip.transform;
      const reactOverlay = { kind: "text" as const, compositionId: clip.compositionId, renderer: "react" as const, startUs: clip.startUs, durationUs: clip.durationUs, sourceOffsetUs: clip.sourceOffsetUs, animationDurationUs: clip.animationDurationUs, autoTiming: Boolean(clip.sourceSubtitleId), text: clip.text, color: appearance.color, accentColor: appearance.accentColor, fontSize: fontSize * outputScale, x: transform.x, y: transform.y, opacity: transform.opacity, scale: transform.scale, rotation: transform.rotation, speed: clip.speed, zIndex: compositionLayer(clip), transformKeyframes: referenceStage ? undefined : clip.transformKeyframes, recipe, params: clip.params, compositionImages: referenceImages, compositionBindings: referenceSlots.length ? clip.bindings : undefined, backdrop: scaleBackdrop(clip.backdrop), motionTheme: project.motionTheme, dimAtUs: clip.dimAtUs };
      if (clip.compositionId !== "focus-card") return [reactOverlay];
      const issues = compositionBindingIssues(clip, project.assets);
      if (issues.length) throw new Error(`${clip.label}：${issues[0]}`);
      const assetId = compositionAssetIds(clip)[0];
      const asset = project.assets.find((candidate) => candidate.id === assetId);
      if (!asset?.sourcePath) throw new Error(`${clip.label}素材缺少本地源路径，无法导出`);
      const sourceVideo = focusCardSourceVideo(clip);
      const playbackRate = sourceVideo?.playbackRate ?? 1;
      const sourceAtClipStartUs = sourceVideo
        ? sourceVideo.sourceInUs + Math.max(0, clip.startUs - sourceVideo.startUs) * playbackRate
        : 0;
      const sourcePresentation = sourceVideo ? videoPresentationAt(sourceVideo, Math.max(0, clip.startUs - sourceVideo.startUs)) : null;
      const sourceRect = sourcePresentation ? focusCardSourceRect(sourcePresentation.transform, sourcePresentation.mask.shape, sourcePresentation.mask.radius, width, height, videoFrameSize(sourcePresentation.mask, width, height, asset.width, asset.height)) : null;
      const sourceOffsetUs = clip.sourceOffsetUs ?? 0;
      const focusMediaSourceInUs = Math.max(0, sourceAtClipStartUs - sourceOffsetUs / clip.speed * playbackRate);
      return [reactOverlay, {
        kind: "composition" as const,
        renderer: "canvas" as const,
        compositionId: "focus-card-media",
        compositionImages: [{ id: asset.id, path: asset.sourcePath, kind: "video" as const }],
        startUs: clip.startUs,
        durationUs: clip.durationUs,
        sourceOffsetUs,
        animationDurationUs: clip.animationDurationUs ?? clip.durationUs,
        params: {
          ...clip.params,
          focusMediaSourceInUs,
          focusMediaPlaybackRate: playbackRate,
          focusEffectSpeed: clip.speed,
          focusMediaAccentColor: appearance.accentColor,
          focusMediaFocusX: sourcePresentation?.mask.focusX ?? 50,
          focusMediaFocusY: sourcePresentation?.mask.focusY ?? 50,
          ...(sourceRect ? {
            focusSourceX: sourceRect.x,
            focusSourceY: sourceRect.y,
            focusSourceWidth: sourceRect.width,
            focusSourceHeight: sourceRect.height,
            focusSourceRadius: sourceRect.radius
          } : {}),
          fit: "cover"
        },
        text: "",
        color: appearance.color,
        accentColor: appearance.accentColor,
        fontSize: fontSize * outputScale,
        x: clip.transform.x,
        y: clip.transform.y,
        opacity: clip.transform.opacity,
        scale: clip.transform.scale,
        rotation: clip.transform.rotation,
        speed: clip.speed,
        zIndex: compositionLayer(clip) + 1,
        transformKeyframes: clip.transformKeyframes,
        recipe: frameRecipe
      }];
    }
    if (clip.kind === "subtitle") {
      const style = subtitleStyle(clip);
      return subtractTimelineRanges(clip, shotcraftSubtitleTakeovers).map((range) => ({
        kind: "text" as const,
        startUs: range.startUs,
        durationUs: range.durationUs,
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
        verticalAnchor: "bottom",
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
      }));
    }
    if (clip.kind === "image") {
      const image = clip as ImageClip;
      const asset = project.assets.find((candidate) => candidate.id === image.assetId);
      if (!asset?.sourcePath) throw new Error(`贴图“${image.label}”缺少本地源路径，无法导出`);
      return dynamicImageOverlays(image, asset.sourcePath, Math.max(8, Math.round(width * 0.3 * image.transform.scale)), momentumExitTransition(image, visualClips));
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
      const progressThickness = Math.max(3, progressHeight * 0.08);
      const itemWidth = width / chapters.length;
      const stepLineThickness = Math.max(2, progressHeight * 0.025);
      const animatedProgress = project.chapterProgress.style === "segments" || project.chapterProgress.style === "line"
        ? {
            xPx: itemWidth * chapterIndex,
            yPx: project.chapterProgress.position === "top" ? progressHeight - progressThickness : 0,
            widthPx: itemWidth,
            heightPx: progressThickness,
            color: project.chapterProgress.activeColor
          }
        : project.chapterProgress.style === "steps" && chapterIndex < chapters.length - 1
          ? {
              xPx: itemWidth * (chapterIndex + 0.5),
              yPx: progressHeight * 0.64 - stepLineThickness / 2,
              widthPx: itemWidth,
              heightPx: stepLineThickness,
              color: project.chapterProgress.activeColor
            }
        : undefined;
      visualOverlays.push({
        kind: "progress",
        startUs,
        durationUs: chapterEndUs - startUs,
        x: 50,
        y: project.chapterProgress.position === "top"
          ? progressHeight / 2 / height * 100
          : 100 - progressHeight / 2 / height * 100,
        opacity: 1,
        scale: 1,
        rotation: 0,
        speed: 1,
        zIndex: 500,
        recipe: frameRecipe,
        chapters,
        chapterIndex,
        position: project.chapterProgress.position,
        style: project.chapterProgress.style,
        backgroundColor: project.chapterProgress.backgroundColor,
        backgroundOpacity: project.chapterProgress.backgroundOpacity,
        activeColor: project.chapterProgress.activeColor,
        inactiveColor: project.chapterProgress.inactiveColor,
        textColor: project.chapterProgress.textColor,
        heightPx: progressHeight,
        showTitles: project.chapterProgress.showTitles,
        animatedProgress
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
    .filter((track) => (track.kind === "scene" || track.kind === "composition") && !track.hidden && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip): clip is SceneClip | CompositionClip => clip.kind === "scene" || clip.kind === "composition");
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
