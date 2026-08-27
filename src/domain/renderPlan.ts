import { contentEndUs, type AudioClip, type EditorProject, type GeneratedBlock, type ImageClip, type VideoClip } from "@/domain/project";
import type { RenderAudioClip, RenderOverlay, RenderPlan, RenderSegment, VideoEncoder } from "@/services/media";
import { effectById } from "@/domain/effects";
import { generatedSceneEffects } from "@/domain/sceneEffects";
import { DEFAULT_TRANSFORM, videoLayoutForPreset } from "@/domain/transforms";

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number): T | undefined {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

function generatedTitle(block: GeneratedBlock, timeUs: number): string {
  let cursor = block.startUs;
  for (const scene of block.scenes) {
    if (timeUs < cursor + scene.durationUs) return scene.title;
    cursor += scene.durationUs;
  }
  return block.label;
}

function generatedSceneAt(block: GeneratedBlock, timeUs: number) {
  let sceneStartUs = block.startUs;
  for (const scene of block.scenes) {
    if (timeUs >= sceneStartUs && timeUs < sceneStartUs + scene.durationUs) {
      return { scene, sceneStartUs, offsetUs: timeUs - sceneStartUs };
    }
    sceneStartUs += scene.durationUs;
  }
  return undefined;
}

export function buildRenderPlan(project: EditorProject, outputPath: string, options: { encoder?: "auto" | VideoEncoder } = {}): RenderPlan {
  const videoTracks = project.tracks.filter((track) => track.kind === "video" && !track.hidden);
  const videoClips = videoTracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video");
  const generated = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips).filter((clip): clip is GeneratedBlock => clip.kind === "generated");
  const endUs = contentEndUs(project);
  const cuts = new Set<number>([0, endUs]);
  for (const clip of [...videoClips, ...generated]) {
    cuts.add(Math.max(0, clip.startUs));
    cuts.add(Math.min(endUs, clip.startUs + clip.durationUs));
    if (clip.kind === "generated") {
      let sceneStart = clip.startUs;
      for (const scene of clip.scenes) {
        sceneStart += scene.durationUs;
        if (sceneStart > clip.startUs && sceneStart < clip.startUs + clip.durationUs) cuts.add(sceneStart);
      }
    }
  }
  const points = [...cuts].filter((point) => point >= 0 && point <= endUs).sort((left, right) => left - right);
  const segments: RenderSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const startUs = points[index];
    const durationUs = points[index + 1] - startUs;
    if (durationUs <= 0) continue;
    const video = activeAt(videoClips.filter((clip) => (clip.zIndex ?? 0) === 0), startUs);
    const block = activeAt(generated, startUs);
    const generatedScene = block ? generatedSceneAt(block, startUs) : undefined;
    const plannedAsset = generatedScene?.scene.mediaAssetId
      ? project.assets.find((asset) => asset.id === generatedScene.scene.mediaAssetId && asset.kind === "video")
      : undefined;
    const usePlannedMedia = Boolean(plannedAsset && block && (block.insertMode !== "overlay" || !video));
    if (usePlannedMedia && plannedAsset && generatedScene) {
      if (!plannedAsset.sourcePath) throw new Error(`AI 分镜素材“${plannedAsset.name}”缺少本地源路径，无法导出`);
      segments.push({
        kind: "video",
        durationUs,
        path: plannedAsset.sourcePath,
        sourceInUs: (Math.min(generatedScene.scene.mediaSourceInUs, Math.max(0, plannedAsset.durationUs - 1)) + generatedScene.offsetUs) % Math.max(1, plannedAsset.durationUs),
        playbackRate: 1,
        volume: generatedScene.scene.mediaVolume,
        fit: generatedScene.scene.mediaFit,
        hasAudio: plannedAsset.hasAudio,
        loop: true,
        camera: generatedScene.scene.camera,
        cameraOffsetUs: generatedScene.offsetUs,
        cameraDurationUs: generatedScene.scene.durationUs
      });
    } else if (block && block.insertMode !== "overlay") {
      segments.push({ kind: "generated", durationUs, color: "#171a1e", title: generatedTitle(block, startUs) });
    } else if (video) {
      const asset = project.assets.find((candidate) => candidate.id === video.assetId);
      if (!asset?.sourcePath) throw new Error(`素材“${video.label}”缺少本地源路径，无法导出`);
      segments.push({
        kind: "video",
        durationUs,
        path: asset.sourcePath,
        sourceInUs: Math.round(video.sourceInUs + (startUs - video.startUs) * video.playbackRate),
        playbackRate: video.playbackRate,
        volume: video.volume * (videoTracks.find((track) => track.id === video.trackId)?.muted ? 0 : 1),
        fit: video.fit,
        hasAudio: asset.hasAudio,
        camera: video.camera,
        cameraOffsetUs: startUs - video.startUs,
        cameraDurationUs: video.durationUs
      });
    } else if (block) {
      segments.push({ kind: "generated", durationUs, color: "#171a1e", title: generatedTitle(block, startUs) });
    } else {
      segments.push({ kind: "gap", durationUs, color: "#171a1e" });
    }
  }
  const visualOverlays: RenderOverlay[] = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips).flatMap<RenderOverlay>((clip): RenderOverlay[] => {
    if (clip.kind === "video" && (clip.zIndex ?? 0) > 0) {
      const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
      if (!asset?.sourcePath) throw new Error(`视频图层“${clip.label}”缺少本地源路径，无法导出`);
      const transform = clip.transform ?? DEFAULT_TRANSFORM;
      return [{ kind: "video", startUs: clip.startUs, durationUs: clip.durationUs, path: asset.sourcePath, sourceInUs: clip.sourceInUs, playbackRate: clip.playbackRate, fit: clip.fit, loop: false, camera: clip.camera, cameraDurationUs: clip.durationUs, x: transform.x, y: transform.y, opacity: transform.opacity, scale: transform.scale, rotation: transform.rotation, speed: 1, zIndex: clip.zIndex ?? 10, transformKeyframes: clip.transformKeyframes, recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 } }];
    }
    if (clip.kind === "effect") {
      return [{ kind: "text" as const, startUs: clip.startUs, durationUs: clip.durationUs, text: clip.text, color: clip.color, accentColor: clip.accentColor, fontSize: clip.fontSize, x: clip.transform.x, y: clip.transform.y, opacity: clip.transform.opacity, scale: clip.transform.scale, rotation: clip.transform.rotation, speed: clip.speed, zIndex: 200 + (clip.zIndex ?? 20), transformKeyframes: clip.transformKeyframes, recipe: clip.recipe ?? effectById(clip.effectId).recipe }];
    }
    if (clip.kind === "subtitle") {
      return [{ kind: "text" as const, startUs: clip.startUs, durationUs: clip.durationUs, text: clip.text, color: clip.color, accentColor: clip.backgroundColor, fontSize: clip.fontSize, x: 50, y: clip.positionY, opacity: 1, scale: 1, rotation: 0, speed: 1, zIndex: 400, recipe: { layout: "panel" as const, entrance: "fade-up" as const, paddingX: 14, paddingY: 6, borderWidth: 0, borderRadius: 3, backgroundOpacity: 0.8 } }];
    }
    if (clip.kind === "image") {
      const image = clip as ImageClip;
      const asset = project.assets.find((candidate) => candidate.id === image.assetId);
      if (!asset?.sourcePath) throw new Error(`贴图“${image.label}”缺少本地源路径，无法导出`);
      return [{ kind: "image" as const, startUs: image.startUs, durationUs: image.durationUs, imagePath: asset.sourcePath, targetWidthPx: Math.max(8, Math.round(project.canvas.width * 0.3 * image.transform.scale)), x: image.transform.x, y: image.transform.y, opacity: image.transform.opacity, scale: image.transform.scale, rotation: image.transform.rotation, speed: image.speed, zIndex: 150, recipe: { layout: "frame" as const, entrance: image.entrance, paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 } }];
    }
    if (clip.kind === "generated") {
      let startUs = clip.startUs;
      return clip.scenes.flatMap((scene) => {
        const sceneStartUs = startUs;
        startUs += scene.durationUs;
        const secondary = scene.secondaryMediaAssetId ? project.assets.find((asset) => asset.id === scene.secondaryMediaAssetId && asset.kind === "video") : undefined;
        const layout = videoLayoutForPreset(scene.mediaLayoutPreset ?? "picture-in-picture-top-right", scene.durationUs);
        const mediaOverlay: RenderOverlay[] = secondary?.sourcePath ? [{ kind: "video", startUs: sceneStartUs, durationUs: scene.durationUs, path: secondary.sourcePath, sourceInUs: scene.secondaryMediaSourceInUs ?? 0, playbackRate: 1, fit: scene.secondaryMediaFit ?? "cover", loop: true, camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" }, cameraDurationUs: scene.durationUs, x: layout.transform.x, y: layout.transform.y, opacity: layout.transform.opacity, scale: layout.transform.scale, rotation: layout.transform.rotation, speed: 1, zIndex: 30, transformKeyframes: layout.transformKeyframes, recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 } }] : [];
        const effectOverlays: RenderOverlay[] = generatedSceneEffects(scene).map((layer) => ({
          kind: "text" as const,
          startUs: sceneStartUs + layer.startOffsetUs,
          durationUs: Math.min(layer.durationUs, Math.max(100_000, scene.durationUs - layer.startOffsetUs)),
          text: layer.text,
          color: layer.textColor,
          accentColor: layer.accentColor,
          fontSize: layer.fontSize,
          x: layer.transform.x,
          y: layer.transform.y,
          opacity: layer.transform.opacity,
          scale: layer.transform.scale,
          rotation: layer.transform.rotation,
          speed: layer.speed,
          zIndex: 200 + layer.zIndex,
          transformKeyframes: layer.transformKeyframes,
          recipe: layer.recipe ?? effectById(layer.effectId).recipe
        }));
        return [...mediaOverlay, ...effectOverlays];
      });
    }
    return [];
  });
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
  for (const track of videoTracks.filter((candidate) => !candidate.muted)) {
    for (const clip of track.clips) {
      if (clip.kind !== "video" || (clip.zIndex ?? 0) <= 0 || clip.volume <= 0) continue;
      const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
      if (!asset?.sourcePath || !asset.hasAudio) continue;
      audios.push({ path: asset.sourcePath, startUs: clip.startUs, durationUs: clip.durationUs, sourceInUs: clip.sourceInUs, playbackRate: clip.playbackRate, volume: clip.volume, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
    }
  }
  for (const block of generated) {
    let sceneStartUs = block.startUs;
    for (const scene of block.scenes) {
      const asset = scene.secondaryMediaAssetId ? project.assets.find((candidate) => candidate.id === scene.secondaryMediaAssetId) : undefined;
      if (asset?.sourcePath && asset.hasAudio && (scene.secondaryMediaVolume ?? 0) > 0) audios.push({ path: asset.sourcePath, startUs: sceneStartUs, durationUs: scene.durationUs, sourceInUs: scene.secondaryMediaSourceInUs ?? 0, playbackRate: 1, volume: scene.secondaryMediaVolume ?? 0, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
      sceneStartUs += scene.durationUs;
    }
  }
  return {
    width: project.canvas.width,
    height: project.canvas.height,
    fps: project.canvas.fpsNumerator / project.canvas.fpsDenominator,
    outputPath,
    encoder: options.encoder ?? "auto",
    segments,
    overlays,
    audios
  };
}
