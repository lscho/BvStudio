import { useEffect, useMemo, useRef, useState } from "react";
import { FileVideo2, Settings2, Sparkles } from "lucide-react";
import { CanvasSettingsDialog } from "@/components/CanvasSettingsDialog";
import type { AudioClip, EffectClip, GeneratedBlock, ImageClip, SubtitleClip, VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { effectAnimationState, effectById, type EffectRecipe } from "@/domain/effects";
import { cameraStateAt } from "@/domain/camera";

interface Props {
  onImport: () => void;
  onGenerate: () => void;
  playing: boolean;
}

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number) {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

function generatedScene(block: GeneratedBlock, playheadUs: number) {
  let cursor = block.startUs;
  for (const scene of block.scenes) {
    if (playheadUs >= cursor && playheadUs < cursor + scene.durationUs) return { scene, startUs: cursor };
    cursor += scene.durationUs;
  }
  return block.scenes[0] ? { scene: block.scenes[0], startUs: block.startUs } : undefined;
}

export function PreviewCanvas({ onImport, onGenerate, playing }: Props) {
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const project = useEditorStore((state) => state.project);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clips = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips);
  const videoClip = activeAt(clips.filter((clip): clip is VideoClip => clip.kind === "video"), playheadUs);
  const generated = activeAt(clips.filter((clip): clip is GeneratedBlock => clip.kind === "generated"), playheadUs);
  const activeEffect = activeAt(clips.filter((clip): clip is EffectClip => clip.kind === "effect"), playheadUs);
  const activeImages = clips.filter((clip): clip is ImageClip => clip.kind === "image" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const subtitle = activeAt(clips.filter((clip): clip is SubtitleClip => clip.kind === "subtitle"), playheadUs);
  const selectedEffect = clips.find((clip): clip is EffectClip => clip.id === selectedClipId && clip.kind === "effect");
  const effect = selectedEffect ?? activeEffect;
  const effectRecipe = effect ? effect.recipe ?? effectById(effect.effectId).recipe : undefined;
  const baseAsset = videoClip ? project.assets.find((candidate) => candidate.id === videoClip.assetId) : undefined;
  const sceneContext = generated ? generatedScene(generated, playheadUs) : undefined;
  const scene = sceneContext?.scene;
  const plannedAsset = scene?.mediaAssetId && generated && (generated.insertMode !== "overlay" || !videoClip)
    ? project.assets.find((candidate) => candidate.id === scene.mediaAssetId && candidate.kind === "video" && !candidate.missing)
    : undefined;
  const asset = plannedAsset ?? baseAsset;
  const sceneRecipe = scene ? scene.recipe ?? effectById(scene.effectId).recipe : undefined;
  const videoTrackMuted = videoClip ? project.tracks.find((track) => track.id === videoClip.trackId)?.muted ?? false : true;
  const activeAudio = project.tracks.filter((track) => track.kind === "audio" && !track.hidden && !track.muted).flatMap((track) => track.clips).filter((clip): clip is AudioClip => clip.kind === "audio" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const voiceActive = activeAudio.some((clip) => clip.role === "voice");
  const cameraContext = plannedAsset && sceneContext && scene
    ? { motion: scene.camera, progress: (playheadUs - sceneContext.startUs) / Math.max(1, scene.durationUs), fit: scene.mediaFit }
    : videoClip
      ? { motion: videoClip.camera, progress: (playheadUs - videoClip.startUs) / Math.max(1, videoClip.durationUs), fit: videoClip.fit }
      : null;
  const cameraState = cameraContext ? cameraStateAt(cameraContext.motion, cameraContext.progress) : null;
  const cameraTranslateX = cameraState ? -cameraState.x * Math.max(0, cameraState.scale - 1) / 2 : 0;
  const cameraTranslateY = cameraState ? -cameraState.y * Math.max(0, cameraState.scale - 1) / 2 : 0;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || (!videoClip && !plannedAsset)) return;
    const playbackRate = plannedAsset ? 1 : videoClip?.playbackRate ?? 1;
    const rawTime = plannedAsset && sceneContext
      ? (scene!.mediaSourceInUs + playheadUs - sceneContext.startUs) / 1_000_000
      : ((videoClip?.sourceInUs ?? 0) + (playheadUs - (videoClip?.startUs ?? 0)) * playbackRate) / 1_000_000;
    const durationSeconds = plannedAsset ? Math.max(0.001, plannedAsset.durationUs / 1_000_000) : 0;
    const time = plannedAsset ? ((rawTime % durationSeconds) + durationSeconds) % durationSeconds : rawTime;
    if (Math.abs(video.currentTime - time) > 0.12) video.currentTime = Math.max(0, time);
    video.playbackRate = playbackRate;
    video.volume = Math.min(1, plannedAsset ? scene?.mediaVolume ?? 0 : videoClip?.volume ?? 1);
    video.muted = plannedAsset ? !asset?.hasAudio || (scene?.mediaVolume ?? 0) <= 0 : videoTrackMuted || !asset?.hasAudio;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [asset?.hasAudio, asset?.objectUrl, asset?.proxyObjectUrl, plannedAsset, playheadUs, playing, scene, sceneContext, videoClip, videoTrackMuted]);

  const hasContent = clips.length > 0;
  const canvasRatio = useMemo(() => `${project.canvas.width} / ${project.canvas.height}`, [project.canvas]);
  const canvasRatioNumber = project.canvas.width / project.canvas.height;
  const animatedStyle = (recipe: EffectRecipe, transform: EffectClip["transform"], startUs: number, speed: number) => {
    const animation = effectAnimationState(recipe, Math.max(0, playheadUs - startUs), speed);
    return {
      opacity: transform.opacity,
      transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) scale(${transform.scale * animation.scale}) rotate(${transform.rotation + animation.rotation}deg)`
    };
  };
  return (
    <section className="preview-stage">
      <div className="preview-toolbar"><span>{project.canvas.width} × {project.canvas.height}</span><span>{Number((project.canvas.fpsNumerator / project.canvas.fpsDenominator).toFixed(3))} fps</span><button type="button" aria-label="设置画布" title="画布与输出规格" onClick={() => setCanvasSettingsOpen(true)}><Settings2 size={13} /></button></div>
      <div className="canvas-wrap">
        <div className="preview-canvas" data-orientation={canvasRatioNumber < 0.8 ? "portrait" : canvasRatioNumber < 1.2 ? "square" : "landscape"} style={{ aspectRatio: canvasRatio, "--canvas-ratio": canvasRatioNumber } as React.CSSProperties}>
          {(asset?.proxyObjectUrl || asset?.objectUrl) && <video ref={videoRef} src={asset.proxyObjectUrl ?? asset.objectUrl} muted playsInline loop={Boolean(plannedAsset)} style={{ objectFit: cameraContext?.fit ?? "cover", transform: cameraState ? `translate(${cameraTranslateX}%, ${cameraTranslateY}%) scale(${cameraState.scale})` : undefined }} />}
          {activeAudio.map((clip) => {
            const audioAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return audioAsset?.objectUrl ? <AudioPreview key={clip.id} clip={clip} src={audioAsset.objectUrl} playheadUs={playheadUs} playing={playing} ducked={voiceActive && clip.role === "music"} /> : null;
          })}
          {generated && !asset && <div className="generated-background" />}
          {generated && scene && sceneRecipe && <div className={`effect-overlay generated-effect recipe-${sceneRecipe.layout} entrance-${sceneRecipe.animation ? "none" : sceneRecipe.entrance} ${selectedClipId === generated.id ? "selected" : ""}`} onPointerDown={(event) => { event.stopPropagation(); selectClip(generated.id); }} style={{ left: `${scene.transform.x}%`, top: `${scene.transform.y}%`, color: sceneRecipe.layout === "number" ? scene.accentColor : scene.textColor, ...animatedStyle(sceneRecipe, scene.transform, sceneContext?.startUs ?? generated.startUs, scene.speed), fontSize: `${scene.fontSize}px`, padding: `${sceneRecipe.paddingY}px ${sceneRecipe.paddingX}px`, borderWidth: sceneRecipe.layout === "frame" ? `${sceneRecipe.borderWidth}px` : undefined, borderColor: scene.accentColor, borderRadius: `${sceneRecipe.borderRadius}px`, backgroundColor: sceneRecipe.backgroundOpacity > 0 ? `rgb(17 19 22 / ${sceneRecipe.backgroundOpacity})` : undefined, borderLeftWidth: sceneRecipe.layout === "panel" ? `${Math.max(2, sceneRecipe.borderWidth)}px` : undefined, "--effect-accent": scene.accentColor, "--effect-speed": `${0.45 / scene.speed}s` } as React.CSSProperties}><span>{scene.title}</span></div>}
          {activeImages.map((clip) => {
            const imageAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return imageAsset?.objectUrl ? <img key={clip.id} className={`image-overlay entrance-${clip.entrance} ${selectedClipId === clip.id ? "selected" : ""}`} src={imageAsset.objectUrl} alt="" draggable={false} onPointerDown={(event) => { event.stopPropagation(); selectClip(clip.id); }} style={{ left: `${clip.transform.x}%`, top: `${clip.transform.y}%`, width: "30%", opacity: clip.transform.opacity, transform: `translate(-50%, -50%) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`, "--effect-speed": `${0.45 / clip.speed}s` } as React.CSSProperties} /> : null;
          })}
          {effect && effectRecipe && <div className={`effect-overlay recipe-${effectRecipe.layout} entrance-${effectRecipe.animation ? "none" : effectRecipe.entrance} ${selectedClipId === effect.id ? "selected" : ""}`} onPointerDown={(event) => { event.stopPropagation(); selectClip(effect.id); }} style={{ left: `${effect.transform.x}%`, top: `${effect.transform.y}%`, color: effectRecipe.layout === "number" ? effect.accentColor : effect.color, ...animatedStyle(effectRecipe, effect.transform, effect.startUs, effect.speed), fontSize: `${effect.fontSize}px`, padding: `${effectRecipe.paddingY}px ${effectRecipe.paddingX}px`, borderWidth: effectRecipe.layout === "frame" ? `${effectRecipe.borderWidth}px` : undefined, borderColor: effect.accentColor, borderRadius: `${effectRecipe.borderRadius}px`, backgroundColor: effectRecipe.backgroundOpacity > 0 ? `rgb(17 19 22 / ${effectRecipe.backgroundOpacity})` : undefined, borderLeftWidth: effectRecipe.layout === "panel" ? `${Math.max(2, effectRecipe.borderWidth)}px` : undefined, "--effect-accent": effect.accentColor, "--effect-speed": `${0.45 / effect.speed}s` } as React.CSSProperties}><span>{effect.text}</span></div>}
          {subtitle && <div className="subtitle-overlay" style={{ bottom: `${100 - subtitle.positionY}%`, color: subtitle.color, backgroundColor: `${subtitle.backgroundColor}cc`, fontSize: `${subtitle.fontSize}px` }}>{subtitle.text}</div>}
          {!hasContent && <div className="empty-canvas"><strong>从任意内容开始</strong><p>导入视频或音频，也可以直接生成 AI 内容。</p><div><button className="button secondary" onClick={onImport}><FileVideo2 size={16} />导入媒体</button><button className="button primary" onClick={onGenerate}><Sparkles size={16} />AI 生成</button></div></div>}
        </div>
      </div>
      <CanvasSettingsDialog open={canvasSettingsOpen} onOpenChange={setCanvasSettingsOpen} canvas={project.canvas} assets={project.assets} />
    </section>
  );
}

function AudioPreview({ clip, src, playheadUs, playing, ducked }: { clip: AudioClip; src: string; playheadUs: number; playing: boolean; ducked: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const time = (clip.sourceInUs + (playheadUs - clip.startUs) * clip.playbackRate) / 1_000_000;
    if (Math.abs(audio.currentTime - time) > 0.12) audio.currentTime = Math.max(0, time);
    audio.playbackRate = clip.playbackRate;
    const localUs = playheadUs - clip.startUs;
    const fadeInGain = clip.fadeInUs > 0 ? Math.min(1, localUs / clip.fadeInUs) : 1;
    const remainingUs = clip.durationUs - localUs;
    const fadeOutGain = clip.fadeOutUs > 0 ? Math.min(1, remainingUs / clip.fadeOutUs) : 1;
    audio.volume = Math.min(1, clip.volume * Math.max(0, Math.min(fadeInGain, fadeOutGain)) * (ducked ? 0.28 : 1));
    if (playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [clip, ducked, playheadUs, playing]);
  return <audio ref={ref} src={src} preload="auto" />;
}
