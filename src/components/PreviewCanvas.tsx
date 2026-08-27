import { useEffect, useMemo, useRef, useState } from "react";
import { FileVideo2, Settings2, Sparkles } from "lucide-react";
import { CanvasSettingsDialog } from "@/components/CanvasSettingsDialog";
import type { AudioClip, EffectClip, GeneratedBlock, ImageClip, SubtitleClip, VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { effectAnimationState, effectById, type EffectRecipe } from "@/domain/effects";
import { cameraMotionForPreset, cameraStateAt, type CameraMotion } from "@/domain/camera";
import { generatedSceneEffects } from "@/domain/sceneEffects";
import { DEFAULT_TRANSFORM, upsertVisualKeyframe, videoLayoutForPreset, visualTransformAt } from "@/domain/transforms";

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

type EffectTransform = EffectClip["transform"];
type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function moveEffectTransform(transform: EffectTransform, deltaX: number, deltaY: number, width: number, height: number): EffectTransform {
  return {
    ...transform,
    x: clamp(transform.x + deltaX / Math.max(1, width) * 100, 0, 100),
    y: clamp(transform.y + deltaY / Math.max(1, height) * 100, 0, 100)
  };
}

export function resizeEffectTransform(transform: EffectTransform, handle: ResizeHandle, deltaX: number, deltaY: number, width: number, height: number): EffectTransform {
  const horizontal = handle.includes("e") ? deltaX / Math.max(1, width) : handle.includes("w") ? -deltaX / Math.max(1, width) : 0;
  const vertical = handle.includes("s") ? deltaY / Math.max(1, height) : handle.includes("n") ? -deltaY / Math.max(1, height) : 0;
  const axes = Number(handle.includes("e") || handle.includes("w")) + Number(handle.includes("n") || handle.includes("s"));
  return { ...transform, scale: clamp(transform.scale * (1 + (horizontal + vertical) / Math.max(1, axes) * 3), 0.3, 3) };
}

function InteractiveEffectOverlay({ className, transform, selected, styleFor, onSelect, onCommit, children }: {
  className: string;
  transform: EffectTransform;
  selected: boolean;
  styleFor: (transform: EffectTransform) => React.CSSProperties;
  onSelect: () => void;
  onCommit: (transform: EffectTransform) => void;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<EffectTransform | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<null | { pointerId: number; handle: ResizeHandle | null; startX: number; startY: number; start: EffectTransform; width: number; height: number; latest: EffectTransform }>(null);
  const liveTransform = draft ?? transform;

  function startGesture(event: React.PointerEvent, handle: ResizeHandle | null) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const canvas = overlayRef.current?.closest(".preview-canvas");
    if (!(canvas instanceof HTMLElement) || !overlayRef.current) return;
    const bounds = canvas.getBoundingClientRect();
    gesture.current = { pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY, start: transform, width: bounds.width, height: bounds.height, latest: transform };
    setDraft(transform);
    overlayRef.current.setPointerCapture(event.pointerId);
  }

  function continueGesture(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    const next = active.handle
      ? resizeEffectTransform(active.start, active.handle, deltaX, deltaY, active.width, active.height)
      : moveEffectTransform(active.start, deltaX, deltaY, active.width, active.height);
    active.latest = next;
    setDraft(next);
  }

  function finishGesture(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    onCommit(active.latest);
  }

  return (
    <div
      ref={overlayRef}
      className={`${className} ${selected ? "selected" : ""} ${draft ? "manipulating" : ""}`}
      style={{ ...styleFor(liveTransform), "--handle-scale": 1 / liveTransform.scale } as React.CSSProperties}
      onPointerDown={(event) => startGesture(event, null)}
      onPointerMove={continueGesture}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      {children}
      {selected && (["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeHandle[]).map((handle) => (
        <i key={handle} className={`canvas-resize-handle handle-${handle}`} aria-hidden="true" onPointerDown={(event) => startGesture(event, handle)} />
      ))}
    </div>
  );
}

export function PreviewCanvas({ onImport, onGenerate, playing }: Props) {
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [selectedGeneratedEffectId, setSelectedGeneratedEffectId] = useState<string | null>(null);
  const project = useEditorStore((state) => state.project);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const updateVideo = useEditorStore((state) => state.updateVideo);
  const updateGeneratedScene = useEditorStore((state) => state.updateGeneratedScene);
  const clips = project.tracks.filter((track) => !track.hidden).flatMap((track) => track.clips);
  const activeVideos = clips.filter((clip): clip is VideoClip => clip.kind === "video" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs).sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0));
  const videoClip = activeVideos.find((clip) => (clip.zIndex ?? 0) === 0);
  const overlayVideos = activeVideos.filter((clip) => clip.id !== videoClip?.id);
  const generated = activeAt(clips.filter((clip): clip is GeneratedBlock => clip.kind === "generated"), playheadUs);
  const activeEffects = clips.filter((clip): clip is EffectClip => clip.kind === "effect" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const activeImages = clips.filter((clip): clip is ImageClip => clip.kind === "image" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const subtitle = activeAt(clips.filter((clip): clip is SubtitleClip => clip.kind === "subtitle"), playheadUs);
  const selectedEffect = clips.find((clip): clip is EffectClip => clip.id === selectedClipId && clip.kind === "effect");
  const visibleEffects = selectedEffect && !activeEffects.some((effect) => effect.id === selectedEffect.id)
    ? [...activeEffects, selectedEffect]
    : activeEffects;
  const baseAsset = videoClip ? project.assets.find((candidate) => candidate.id === videoClip.assetId) : undefined;
  const sceneContext = generated ? generatedScene(generated, playheadUs) : undefined;
  const scene = sceneContext?.scene;
  const sceneLocalUs = sceneContext ? playheadUs - sceneContext.startUs : 0;
  const sceneEffects = scene ? generatedSceneEffects(scene).filter((layer) => sceneLocalUs >= layer.startOffsetUs && sceneLocalUs < layer.startOffsetUs + layer.durationUs) : [];
  const plannedAsset = scene?.mediaAssetId && generated && (generated.insertMode !== "overlay" || !videoClip)
    ? project.assets.find((candidate) => candidate.id === scene.mediaAssetId && candidate.kind === "video" && !candidate.missing)
    : undefined;
  const asset = plannedAsset ?? baseAsset;
  const secondaryAsset = scene?.secondaryMediaAssetId ? project.assets.find((candidate) => candidate.id === scene.secondaryMediaAssetId && candidate.kind === "video" && !candidate.missing) : undefined;
  const activeAudio = project.tracks.filter((track) => track.kind === "audio" && !track.hidden && !track.muted).flatMap((track) => track.clips).filter((clip): clip is AudioClip => clip.kind === "audio" && playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const voiceActive = activeAudio.some((clip) => clip.role === "voice");
  const hasContent = clips.length > 0;
  const canvasRatio = useMemo(() => `${project.canvas.width} / ${project.canvas.height}`, [project.canvas]);
  const canvasRatioNumber = project.canvas.width / project.canvas.height;
  const canvasLength = (pixels: number, minimum = 0) => minimum > 0
    ? `clamp(${minimum}px, ${pixels / project.canvas.width * 100}cqw, ${pixels}px)`
    : `${pixels / project.canvas.width * 100}cqw`;
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
          {(asset?.proxyObjectUrl || asset?.objectUrl) && sceneContext && scene && plannedAsset && <SyncedVideo className="base-video-layer" src={asset.proxyObjectUrl ?? asset.objectUrl!} sourceInUs={scene.mediaSourceInUs} localUs={playheadUs - sceneContext.startUs} playbackRate={1} volume={scene.mediaVolume} muted={!asset.hasAudio || scene.mediaVolume <= 0} fit={scene.mediaFit} camera={scene.camera} cameraDurationUs={scene.durationUs} playing={playing} loopDurationUs={asset.durationUs} />}
          {(baseAsset?.proxyObjectUrl || baseAsset?.objectUrl) && videoClip && !plannedAsset && <SyncedVideo className={`base-video-layer ${selectedClipId === videoClip.id ? "selected" : ""}`} src={baseAsset.proxyObjectUrl ?? baseAsset.objectUrl!} sourceInUs={videoClip.sourceInUs} localUs={playheadUs - videoClip.startUs} playbackRate={videoClip.playbackRate} volume={videoClip.volume} muted={!baseAsset.hasAudio || Boolean(project.tracks.find((track) => track.id === videoClip.trackId)?.muted)} fit={videoClip.fit} camera={videoClip.camera} cameraDurationUs={videoClip.durationUs} playing={playing} onSelect={() => selectClip(videoClip.id)} />}
          {activeAudio.map((clip) => {
            const audioAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return audioAsset?.objectUrl ? <AudioPreview key={clip.id} clip={clip} src={audioAsset.objectUrl} playheadUs={playheadUs} playing={playing} ducked={voiceActive && clip.role === "music"} /> : null;
          })}
          {generated && !asset && <div className="generated-background" />}
          {overlayVideos.map((video) => {
            const videoAsset = project.assets.find((candidate) => candidate.id === video.assetId);
            const src = videoAsset?.proxyObjectUrl ?? videoAsset?.objectUrl;
            if (!src) return null;
            const base = video.transform ?? DEFAULT_TRANSFORM;
            const localUs = playheadUs - video.startUs;
            const transform = visualTransformAt(base, video.transformKeyframes, localUs);
            return <InteractiveEffectOverlay key={video.id} className="video-layer overlay-video-layer" transform={transform} selected={selectedClipId === video.id} onSelect={() => selectClip(video.id)} onCommit={(nextTransform) => updateVideo(video.id, video.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(video.transformKeyframes, localUs, nextTransform), layoutPreset: "custom" } : { transform: nextTransform, layoutPreset: "custom" })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, width: "100%", height: "100%", zIndex: 20 + (video.zIndex ?? 10), opacity: nextTransform.opacity, transform: `translate(-50%, -50%) scale(${nextTransform.scale}) rotate(${nextTransform.rotation}deg)` })}>
              <SyncedVideo src={src} sourceInUs={video.sourceInUs} localUs={localUs} playbackRate={video.playbackRate} volume={video.volume} muted={!videoAsset?.hasAudio || Boolean(project.tracks.find((track) => track.id === video.trackId)?.muted)} fit={video.fit} camera={video.camera} cameraDurationUs={video.durationUs} playing={playing} />
            </InteractiveEffectOverlay>;
          })}
          {secondaryAsset && scene && sceneContext && (secondaryAsset.proxyObjectUrl || secondaryAsset.objectUrl) && (() => {
            const layout = videoLayoutForPreset(scene.mediaLayoutPreset ?? "picture-in-picture-top-right", scene.durationUs);
            const transform = visualTransformAt(layout.transform, layout.transformKeyframes, sceneLocalUs);
            return <div className="video-layer generated-secondary-video" style={{ left: `${transform.x}%`, top: `${transform.y}%`, width: "100%", height: "100%", zIndex: 35, opacity: transform.opacity, transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)` }}><SyncedVideo src={secondaryAsset.proxyObjectUrl ?? secondaryAsset.objectUrl!} sourceInUs={scene.secondaryMediaSourceInUs ?? 0} localUs={sceneLocalUs} playbackRate={1} volume={scene.secondaryMediaVolume ?? 0} muted={!secondaryAsset.hasAudio || (scene.secondaryMediaVolume ?? 0) <= 0} fit={scene.secondaryMediaFit ?? "cover"} camera={cameraMotionForPreset("none")} cameraDurationUs={scene.durationUs} playing={playing} loopDurationUs={secondaryAsset.durationUs} /></div>;
          })()}
          {generated && scene && sceneContext && sceneEffects.map((layer) => {
            const recipe = layer.recipe ?? effectById(layer.effectId).recipe;
            const primaryId = `${scene.id}:primary`;
            const selectedLayerId = selectedGeneratedEffectId ?? primaryId;
            const localLayerUs = sceneLocalUs - layer.startOffsetUs;
            const layerTransform = visualTransformAt(layer.transform, layer.transformKeyframes, localLayerUs);
            return <InteractiveEffectOverlay key={layer.id} className={`effect-overlay generated-effect recipe-${recipe.layout} entrance-${recipe.animation ? "none" : recipe.entrance}`} transform={layerTransform} selected={selectedClipId === generated.id && selectedLayerId === layer.id} onSelect={() => { setSelectedGeneratedEffectId(layer.id); selectClip(generated.id); }} onCommit={(transform) => {
              const patch = layer.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(layer.transformKeyframes, localLayerUs, transform) } : { transform };
              if (layer.id === primaryId) updateGeneratedScene(generated.id, scene.id, patch);
              else updateGeneratedScene(generated.id, scene.id, { additionalEffects: (scene.additionalEffects ?? []).map((item) => item.id === layer.id ? { ...item, ...patch } : item) });
            }} styleFor={(transform) => ({ left: `${transform.x}%`, top: `${transform.y}%`, zIndex: 200 + layer.zIndex, color: recipe.layout === "number" ? layer.accentColor : layer.textColor, ...animatedStyle(recipe, transform, sceneContext.startUs + layer.startOffsetUs, layer.speed), fontSize: canvasLength(layer.fontSize, 10), padding: `${canvasLength(recipe.paddingY, 2)} ${canvasLength(recipe.paddingX, 2)}`, borderWidth: recipe.layout === "frame" ? canvasLength(recipe.borderWidth, 1) : undefined, borderColor: layer.accentColor, borderRadius: canvasLength(recipe.borderRadius), backgroundColor: recipe.backgroundOpacity > 0 ? `rgb(17 19 22 / ${recipe.backgroundOpacity})` : undefined, borderLeftWidth: recipe.layout === "panel" ? canvasLength(Math.max(2, recipe.borderWidth), 1) : undefined, "--effect-accent": layer.accentColor, "--effect-speed": `${0.45 / layer.speed}s` } as React.CSSProperties)}><span>{layer.text}</span></InteractiveEffectOverlay>;
          })}
          {activeImages.map((clip) => {
            const imageAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return imageAsset?.objectUrl ? <img key={clip.id} className={`image-overlay entrance-${clip.entrance} ${selectedClipId === clip.id ? "selected" : ""}`} src={imageAsset.objectUrl} alt="" draggable={false} onPointerDown={(event) => { event.stopPropagation(); selectClip(clip.id); }} style={{ left: `${clip.transform.x}%`, top: `${clip.transform.y}%`, width: "30%", opacity: clip.transform.opacity, transform: `translate(-50%, -50%) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`, "--effect-speed": `${0.45 / clip.speed}s` } as React.CSSProperties} /> : null;
          })}
          {visibleEffects.sort((left, right) => (left.zIndex ?? 20) - (right.zIndex ?? 20)).map((effect) => {
            const recipe = effect.recipe ?? effectById(effect.effectId).recipe;
            const localUs = playheadUs - effect.startUs;
            const transform = visualTransformAt(effect.transform, effect.transformKeyframes, localUs);
            return <InteractiveEffectOverlay key={effect.id} className={`effect-overlay recipe-${recipe.layout} entrance-${recipe.animation ? "none" : recipe.entrance}`} transform={transform} selected={selectedClipId === effect.id} onSelect={() => selectClip(effect.id)} onCommit={(nextTransform) => updateEffect(effect.id, effect.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(effect.transformKeyframes, localUs, nextTransform) } : { transform: nextTransform })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, zIndex: 200 + (effect.zIndex ?? 20), color: recipe.layout === "number" ? effect.accentColor : effect.color, ...animatedStyle(recipe, nextTransform, effect.startUs, effect.speed), fontSize: canvasLength(effect.fontSize, 10), padding: `${canvasLength(recipe.paddingY, 2)} ${canvasLength(recipe.paddingX, 2)}`, borderWidth: recipe.layout === "frame" ? canvasLength(recipe.borderWidth, 1) : undefined, borderColor: effect.accentColor, borderRadius: canvasLength(recipe.borderRadius), backgroundColor: recipe.backgroundOpacity > 0 ? `rgb(17 19 22 / ${recipe.backgroundOpacity})` : undefined, borderLeftWidth: recipe.layout === "panel" ? canvasLength(Math.max(2, recipe.borderWidth), 1) : undefined, "--effect-accent": effect.accentColor, "--effect-speed": `${0.45 / effect.speed}s` } as React.CSSProperties)}><span>{effect.text}</span></InteractiveEffectOverlay>;
          })}
          {subtitle && <div className="subtitle-overlay" style={{ bottom: `${100 - subtitle.positionY}%`, color: subtitle.color, backgroundColor: `${subtitle.backgroundColor}cc`, fontSize: canvasLength(subtitle.fontSize, 9) }}>{subtitle.text}</div>}
          {!hasContent && <div className="empty-canvas"><strong>从任意内容开始</strong><p>导入视频或音频，也可以直接生成 AI 内容。</p><div><button className="button secondary" onClick={onImport}><FileVideo2 size={16} />导入媒体</button><button className="button primary" onClick={onGenerate}><Sparkles size={16} />AI 生成</button></div></div>}
        </div>
      </div>
      <CanvasSettingsDialog open={canvasSettingsOpen} onOpenChange={setCanvasSettingsOpen} canvas={project.canvas} assets={project.assets} />
    </section>
  );
}

function SyncedVideo({ src, sourceInUs, localUs, playbackRate, volume, muted, fit, camera, cameraDurationUs, playing, loopDurationUs, className = "video-content", onSelect }: { src: string; sourceInUs: number; localUs: number; playbackRate: number; volume: number; muted: boolean; fit: "cover" | "contain"; camera: CameraMotion; cameraDurationUs: number; playing: boolean; loopDurationUs?: number; className?: string; onSelect?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const cameraState = cameraStateAt(camera, localUs / Math.max(1, cameraDurationUs));
  const cameraTranslateX = -cameraState.x * Math.max(0, cameraState.scale - 1) / 2;
  const cameraTranslateY = -cameraState.y * Math.max(0, cameraState.scale - 1) / 2;
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const rawTimeUs = sourceInUs + localUs * playbackRate;
    const timeUs = loopDurationUs ? ((rawTimeUs % Math.max(1, loopDurationUs)) + loopDurationUs) % loopDurationUs : rawTimeUs;
    const time = Math.max(0, timeUs / 1_000_000);
    if (Math.abs(video.currentTime - time) > 0.12) video.currentTime = time;
    video.playbackRate = playbackRate;
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = muted;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [localUs, loopDurationUs, muted, playbackRate, playing, sourceInUs, volume]);
  return <div className={className ?? "video-content"} onPointerDown={onSelect ? (event) => { event.stopPropagation(); onSelect(); } : undefined}><video ref={ref} src={src} muted={muted} playsInline loop={Boolean(loopDurationUs)} style={{ objectFit: fit, transform: `translate(${cameraTranslateX}%, ${cameraTranslateY}%) scale(${cameraState.scale})` }} /></div>;
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
