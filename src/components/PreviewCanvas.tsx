import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, FileVideo2, ListTree, Settings2, Sparkles } from "lucide-react";
import { CanvasSettingsDialog } from "@/components/CanvasSettingsDialog";
import { ChapterProgressDialog } from "@/components/ChapterProgressDialog";
import { EffectChartCanvas } from "@/components/EffectChartCanvas";
import { contentEndUs, type AudioClip, type EffectClip, type GeneratedBlock, type ImageClip, type SceneClip, type SubtitleClip, type VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { effectAnimationState, effectById, type EffectRecipe, type SceneBackgroundSpec } from "@/domain/effects";
import { measureChartBox } from "@/domain/chartEffects";
import { cameraStateAt, type CameraMotion } from "@/domain/camera";
import { upsertVisualKeyframe, visualTransformAt } from "@/domain/transforms";
import { createMediaPlaybackGate, mediaNeedsSeek, previewMediaTimeSeconds, syncMediaPlayback } from "@/domain/playback";
import { activeVideoPresentationCue, focusEnvelope, transitionEnvelope, videoFocus, videoPresentationAt, videoTransition } from "@/domain/videoPresentation";
import { chapterProgressAt, displaySubtitleText, highlightedTextParts, subtitleStyle } from "@/domain/videoDecorations";
import { localMediaUrl } from "@/services/media";

interface Props {
  onImport: () => void;
  onGenerate: () => void;
  playing: boolean;
}

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number) {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

type EffectTransform = EffectClip["transform"];
type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function colorWithOpacity(color: string, opacity: number) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(color);
  if (!match) return color;
  return `rgb(${Number.parseInt(match[1], 16)} ${Number.parseInt(match[2], 16)} ${Number.parseInt(match[3], 16)} / ${clamp(opacity, 0, 1)})`;
}

function sceneBackgroundStyle(scene: SceneBackgroundSpec): React.CSSProperties {
  const strength = clamp(scene.intensity, 0.1, 1);
  const secondary = colorWithOpacity(scene.secondaryColor, strength);
  const border = colorWithOpacity(scene.borderColor, Math.max(0.35, strength));
  const common: React.CSSProperties = { backgroundColor: scene.primaryColor };
  if (scene.preset === "black-stripes") return { ...common, backgroundImage: `repeating-linear-gradient(135deg, transparent 0 12px, ${secondary} 12px 14px)` };
  if (scene.preset === "white-frame") return { ...common, boxShadow: `inset 0 0 0 1.2cqw ${border}, inset 0 0 0 1.55cqw ${scene.secondaryColor}` };
  if (scene.preset === "dark-grid" || scene.preset === "blueprint") return { ...common, backgroundImage: `linear-gradient(${secondary} 1px, transparent 1px), linear-gradient(90deg, ${secondary} 1px, transparent 1px)`, backgroundSize: "5cqw 5cqw" };
  if (scene.preset === "clean-white") return { ...common, boxShadow: `inset 0 0.8cqw 0 ${border}` };
  if (scene.preset === "spotlight") return { ...common, backgroundImage: `radial-gradient(circle at 50% 44%, ${secondary} 0, ${scene.primaryColor} 58%)` };
  if (scene.preset === "paper-lines") return { ...common, backgroundImage: `repeating-linear-gradient(0deg, transparent 0 4.4cqw, ${secondary} 4.4cqw calc(4.4cqw + 1px))`, boxShadow: `inset 7cqw 0 0 -6.85cqw ${border}` };
  return { ...common, backgroundImage: `linear-gradient(90deg, ${scene.secondaryColor} 0 24%, transparent 24%)`, boxShadow: `inset 24.3cqw 0 0 -24cqw ${border}` };
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

export function videoTargetPoint(clientX: number, clientY: number, bounds: Pick<DOMRect, "left" | "top" | "width" | "height">): VideoTargetPoint {
  return {
    x: clamp((clientX - bounds.left) / Math.max(1, bounds.width) * 100, 0, 100),
    y: clamp((clientY - bounds.top) / Math.max(1, bounds.height) * 100, 0, 100)
  };
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

interface VideoTargetPoint {
  x: number;
  y: number;
}

function VideoTargetHandle({ point, kind, onCommit }: { point: VideoTargetPoint; kind: "crop" | "focus"; onCommit: (point: VideoTargetPoint) => void }) {
  const [draft, setDraft] = useState<VideoTargetPoint | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<null | { pointerId: number; bounds: DOMRect; latest: VideoTargetPoint }>(null);
  const livePoint = draft ?? point;
  const label = kind === "crop" ? "取景中心" : "聚焦点";

  function updateFromPointer(clientX: number, clientY: number) {
    const active = gesture.current;
    if (!active) return;
    const next = videoTargetPoint(clientX, clientY, active.bounds);
    active.latest = next;
    setDraft(next);
  }

  function finish(event: React.PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    onCommit(active.latest);
  }

  return <button
    ref={handleRef}
    type="button"
    className={`video-target-handle ${kind}`}
    aria-label={`拖动调整${label}`}
    title={`拖动调整${label}`}
    style={{ left: `${livePoint.x}%`, top: `${livePoint.y}%` }}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const layer = handleRef.current?.closest(".video-layer");
      if (!(layer instanceof HTMLElement)) return;
      gesture.current = { pointerId: event.pointerId, bounds: layer.getBoundingClientRect(), latest: point };
      setDraft(point);
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (gesture.current?.pointerId !== event.pointerId) return;
      event.stopPropagation();
      updateFromPointer(event.clientX, event.clientY);
    }}
    onPointerUp={finish}
    onPointerCancel={finish}
    onKeyDown={(event) => {
      const delta = event.shiftKey ? 10 : 2;
      const next = { ...point };
      if (event.key === "ArrowLeft") next.x = clamp(next.x - delta, 0, 100);
      else if (event.key === "ArrowRight") next.x = clamp(next.x + delta, 0, 100);
      else if (event.key === "ArrowUp") next.y = clamp(next.y - delta, 0, 100);
      else if (event.key === "ArrowDown") next.y = clamp(next.y + delta, 0, 100);
      else return;
      event.preventDefault();
      event.stopPropagation();
      onCommit(next);
    }}
  ><Crosshair size={15} /></button>;
}

export function PreviewCanvas({ onImport, onGenerate, playing }: Props) {
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [chapterSettingsOpen, setChapterSettingsOpen] = useState(false);
  const project = useEditorStore((state) => state.project);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const updateEffect = useEditorStore((state) => state.updateEffect);
  const updateVideo = useEditorStore((state) => state.updateVideo);
  const updateVideoPresentationCue = useEditorStore((state) => state.updateVideoPresentationCue);
  const focusPickClipId = useEditorStore((state) => state.focusPickClipId);
  const setFocusPickClip = useEditorStore((state) => state.setFocusPickClip);
  const clipIndex = useMemo(() => {
    const visibleTracks = project.tracks.filter((track) => !track.hidden);
    const clips = visibleTracks.flatMap((track) => track.clips);
    return {
      clips,
      videos: clips.filter((clip): clip is VideoClip => clip.kind === "video"),
      generated: clips.filter((clip): clip is GeneratedBlock => clip.kind === "generated"),
      scenes: clips.filter((clip): clip is SceneClip => clip.kind === "scene"),
      effects: clips.filter((clip): clip is EffectClip => clip.kind === "effect"),
      images: clips.filter((clip): clip is ImageClip => clip.kind === "image"),
      subtitles: clips.filter((clip): clip is SubtitleClip => clip.kind === "subtitle"),
      audio: visibleTracks.filter((track) => track.kind === "audio" && !track.muted).flatMap((track) => track.clips).filter((clip): clip is AudioClip => clip.kind === "audio")
    };
  }, [project]);
  const activeVideos = clipIndex.videos.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs).sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0));
  const generated = activeAt(clipIndex.generated, playheadUs);
  const activeScenes = clipIndex.scenes.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const activeEffects = clipIndex.effects.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const activeImages = clipIndex.images.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const subtitle = activeAt(clipIndex.subtitles, playheadUs);
  const activeSubtitleStyle = subtitle ? subtitleStyle(subtitle) : null;
  const chapterState = chapterProgressAt(project.chapterProgress.chapters, playheadUs, Math.max(1, contentEndUs(project)));
  const selectedEffect = clipIndex.effects.find((clip) => clip.id === selectedClipId);
  const visibleEffects = selectedEffect && !activeEffects.some((effect) => effect.id === selectedEffect.id)
    ? [...activeEffects, selectedEffect]
    : activeEffects;
  const selectedScene = clipIndex.scenes.find((clip) => clip.id === selectedClipId);
  const visibleScenes = selectedScene && !activeScenes.some((scene) => scene.id === selectedScene.id)
    ? [...activeScenes, selectedScene]
    : activeScenes;
  const foregroundEffects = visibleEffects;
  const activeAudio = clipIndex.audio.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const activeEffectSounds = [...activeScenes, ...activeEffects].flatMap((sourceClip) => (sourceClip.soundCues ?? []).flatMap((cue, cueIndex) => {
    const startUs = sourceClip.startUs + cue.offsetUs;
    const durationUs = Math.min(cue.durationUs, sourceClip.startUs + sourceClip.durationUs - startUs);
    if (!cue.sourcePath || durationUs <= 0 || playheadUs < startUs || playheadUs >= startUs + durationUs) return [];
    const clip: AudioClip = {
      id: `effect-sound:${sourceClip.id}:${cueIndex}`,
      trackId: sourceClip.trackId,
      kind: "audio",
      label: cue.soundId,
      startUs,
      durationUs,
      locked: true,
      assetId: cue.soundId,
      sourceInUs: 0,
      playbackRate: 1,
      volume: cue.volume,
      fadeInUs: 0,
      fadeOutUs: 0,
      role: "sound"
    };
    return [{ clip, sourcePath: cue.sourcePath }];
  }));
  const voiceActive = activeAudio.some((clip) => clip.role === "voice");
  const hasContent = clipIndex.clips.length > 0;
  const canvasRatio = useMemo(() => `${project.canvas.width} / ${project.canvas.height}`, [project.canvas]);
  const canvasRatioNumber = project.canvas.width / project.canvas.height;
  const canvasLength = (pixels: number, minimum = 0) => minimum > 0
    ? `clamp(${minimum}px, ${pixels / project.canvas.width * 100}cqw, ${pixels}px)`
    : `${pixels / project.canvas.width * 100}cqw`;
  const animatedStyle = (recipe: EffectRecipe, transform: EffectClip["transform"], startUs: number, speed: number) => {
    const animation = effectAnimationState(recipe, Math.max(0, playheadUs - startUs), speed);
    const tilt = (animation.rotateX || animation.rotateY)
      ? ` ${animation.perspective >= 100 ? `perspective(${Math.min(4000, animation.perspective)}px)` : "perspective(1000px)"} rotateX(${animation.rotateX}deg) rotateY(${animation.rotateY}deg)`
      : "";
    return {
      opacity: transform.opacity,
      transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) scale(${transform.scale * animation.scale}) rotate(${transform.rotation + animation.rotation}deg)${tilt}`
    };
  };
  const chartProgressFor = (recipe: EffectRecipe, startUs: number, speed: number) => {
    const spec = recipe.chart;
    if (!spec) return 0;
    const durationUs = Math.max(50_000, (spec.durationSeconds ?? 1.2) * 1_000_000 / Math.max(0.1, speed));
    return Math.max(0, Math.min(1, (playheadUs - startUs) / durationUs));
  };
  const pickFocus = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!focusPickClipId) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const clip = clipIndex.videos.find((candidate) => candidate.id === focusPickClipId);
    if (!clip) return setFocusPickClip(null);
    const x = Math.max(0, Math.min(100, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - bounds.top) / Math.max(1, bounds.height) * 100));
    const cue = activeVideoPresentationCue(clip, playheadUs - clip.startUs);
    if (cue) updateVideoPresentationCue(clip.id, cue.id, { focus: { ...cue.focus, enabled: true, x, y } });
    else updateVideo(clip.id, { focus: { ...videoFocus(clip), enabled: true, x, y } });
    setFocusPickClip(null);
  };
  return (
    <section className="preview-stage">
      <div className="preview-toolbar"><span>{project.canvas.width} × {project.canvas.height}</span><span>{Number((project.canvas.fpsNumerator / project.canvas.fpsDenominator).toFixed(3))} fps</span><button type="button" aria-label="设置章节进度" title="顶部章节进度" onClick={() => setChapterSettingsOpen(true)}><ListTree size={13} /></button><button type="button" aria-label="设置画布" title="画布与输出规格" onClick={() => setCanvasSettingsOpen(true)}><Settings2 size={13} /></button></div>
      <div className="canvas-wrap">
        <div className={`preview-canvas ${!hasContent ? "empty-preview" : ""} ${focusPickClipId ? "picking-focus" : ""}`} onPointerDownCapture={pickFocus} data-orientation={canvasRatioNumber < 0.8 ? "portrait" : canvasRatioNumber < 1.2 ? "square" : "landscape"} style={{ aspectRatio: canvasRatio, "--canvas-ratio": canvasRatioNumber } as React.CSSProperties}>
          {activeAudio.map((clip) => {
            const audioAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return audioAsset?.objectUrl ? <AudioPreview key={clip.id} clip={clip} src={audioAsset.objectUrl} playheadUs={playheadUs} playing={playing} ducked={voiceActive && clip.role === "music"} /> : null;
          })}
          {activeEffectSounds.map(({ clip, sourcePath }) => <AudioPreview key={clip.id} clip={clip} src={localMediaUrl(sourcePath)} playheadUs={playheadUs} playing={playing} ducked={false} />)}
          {visibleScenes.map((scene) => <div key={scene.id} className="scene-background" style={{ ...sceneBackgroundStyle(scene.background), opacity: scene.opacity }} />)}
          {generated && !activeVideos.length && !visibleScenes.length && <div className="generated-background" />}
          {activeVideos.map((video) => {
            const videoAsset = project.assets.find((candidate) => candidate.id === video.assetId);
            const src = videoAsset?.proxyObjectUrl ?? videoAsset?.objectUrl;
            if (!src) return null;
            const localUs = playheadUs - video.startUs;
            const presentation = videoPresentationAt(video, localUs);
            const transform = presentation.transform;
            const mask = presentation.mask;
            const transition = video.presentationCues?.length ? { ...videoTransition(video), preset: "none" as const } : videoTransition(video);
            const squareFrame = mask.shape === "circle" || mask.shape === "square";
            const transitionProgress = transitionEnvelope(video, localUs);
            const transitionX = transition.preset === "slide-left" ? (1 - transitionProgress) * 100 : transition.preset === "slide-right" ? (transitionProgress - 1) * 100 : 0;
            const transitionScale = transition.preset === "zoom"
              ? 0.72 + transitionProgress * 0.28
              : transition.preset === "dock" && !video.transformKeyframes?.length ? 0.15 + transitionProgress * 0.85 : 1;
            const clipPath = mask.shape === "circle" ? "circle(50% at 50% 50%)" : mask.shape === "ellipse" ? "ellipse(50% 50% at 50% 50%)" : mask.shape === "square" ? "inset(0 21.875%)" : mask.shape === "portrait" ? "inset(0 34.18%)" : undefined;
            return <InteractiveEffectOverlay key={video.id} className="video-layer" transform={transform} selected={selectedClipId === video.id} onSelect={() => selectClip(video.id)} onCommit={(nextTransform) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { transform: nextTransform }) : updateVideo(video.id, video.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(video.transformKeyframes, localUs, nextTransform), layoutPreset: "custom" } : { transform: nextTransform, layoutPreset: "custom" })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, width: squareFrame && canvasRatioNumber >= 1 ? "auto" : "100%", height: squareFrame && canvasRatioNumber < 1 ? "auto" : "100%", aspectRatio: squareFrame ? "1 / 1" : undefined, zIndex: 20 + (video.zIndex ?? 0), opacity: nextTransform.opacity * (transition.preset === "fade" || transition.preset === "circle-reveal" ? transitionProgress : 1), clipPath, borderRadius: mask.shape === "circle" ? "50%" : mask.shape === "rounded" ? `${mask.radius}%` : undefined, border: mask.borderWidth > 0 ? `${canvasLength(mask.borderWidth, 1)} solid ${mask.borderColor}` : undefined, transform: `translate(-50%, -50%) translateX(${transitionX}%) scale(${nextTransform.scale * transitionScale}) rotate(${nextTransform.rotation}deg)` })}>
              <SyncedVideo src={src} sourceInUs={video.sourceInUs} localUs={localUs} playbackRate={video.playbackRate} volume={video.volume} muted={videoAsset?.hasAudio === false || video.volume <= 0 || Boolean(project.tracks.find((track) => track.id === video.trackId)?.muted)} fit={presentation.fit} camera={presentation.camera} cameraStartOffsetUs={presentation.cameraStartOffsetUs} cameraDurationUs={presentation.cameraDurationUs} focus={presentation.focus} contentFocus={{ x: mask.focusX, y: mask.focusY }} playing={playing} />
              {presentation.focus.enabled && focusEnvelope(presentation.focus, localUs) > 0 && <div className="video-focus-overlay" style={{ "--focus-x": `${presentation.focus.x}%`, "--focus-y": `${presentation.focus.y}%`, "--focus-radius": `${presentation.focus.radius}%`, "--focus-feather": `${presentation.focus.feather}%`, "--focus-dim": presentation.focus.dimOpacity } as React.CSSProperties}>{presentation.focus.showCursor && <i />}</div>}
              {selectedClipId === video.id && mask.shape === "circle" && <VideoTargetHandle point={{ x: mask.focusX, y: mask.focusY }} kind="crop" onCommit={(point) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { mask: { ...mask, focusX: point.x, focusY: point.y } }) : updateVideo(video.id, { mask: { ...mask, focusX: point.x, focusY: point.y } })} />}
              {selectedClipId === video.id && presentation.focus.enabled && <VideoTargetHandle point={{ x: presentation.focus.x, y: presentation.focus.y }} kind="focus" onCommit={(point) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { focus: { ...presentation.focus, x: point.x, y: point.y } }) : updateVideo(video.id, { focus: { ...presentation.focus, x: point.x, y: point.y } })} />}
            </InteractiveEffectOverlay>;
          })}
          {activeImages.map((clip) => {
            const imageAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return imageAsset?.objectUrl ? <img key={clip.id} className={`image-overlay entrance-${clip.entrance} ${selectedClipId === clip.id ? "selected" : ""}`} src={imageAsset.objectUrl} alt="" draggable={false} onPointerDown={(event) => { event.stopPropagation(); selectClip(clip.id); }} style={{ left: `${clip.transform.x}%`, top: `${clip.transform.y}%`, width: "30%", opacity: clip.transform.opacity, transform: `translate(-50%, -50%) scale(${clip.transform.scale}) rotate(${clip.transform.rotation}deg)`, "--effect-speed": `${0.45 / clip.speed}s` } as React.CSSProperties} /> : null;
          })}
          {foregroundEffects.sort((left, right) => (left.zIndex ?? 20) - (right.zIndex ?? 20)).map((effect) => {
            const recipe = effect.recipe ?? effectById(effect.effectId).recipe;
            const localUs = playheadUs - effect.startUs;
            const transform = visualTransformAt(effect.transform, effect.transformKeyframes, localUs);
            const backdrop = effect.backdrop;
            const frameBorderWidth = recipe.layout === "frame" ? canvasLength(recipe.borderWidth, 1) : undefined;
            return <InteractiveEffectOverlay key={effect.id} className={`effect-overlay recipe-${recipe.layout} entrance-${recipe.animation ? "none" : recipe.entrance}`} transform={transform} selected={selectedClipId === effect.id} onSelect={() => selectClip(effect.id)} onCommit={(nextTransform) => updateEffect(effect.id, effect.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(effect.transformKeyframes, localUs, nextTransform) } : { transform: nextTransform })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, zIndex: 200 + (effect.zIndex ?? 20), color: recipe.layout === "number" ? effect.accentColor : effect.color, ...animatedStyle(recipe, nextTransform, effect.startUs, effect.speed), fontSize: canvasLength(effect.fontSize, 10), padding: backdrop?.enabled ? `${canvasLength(backdrop.paddingY, 2)} ${canvasLength(backdrop.paddingX, 2)}` : `${canvasLength(recipe.paddingY, 2)} ${canvasLength(recipe.paddingX, 2)}`, borderTopWidth: frameBorderWidth, borderRightWidth: frameBorderWidth, borderBottomWidth: frameBorderWidth, borderLeftWidth: recipe.layout === "panel" ? canvasLength(Math.max(2, recipe.borderWidth), 1) : frameBorderWidth, borderColor: effect.accentColor, borderRadius: backdrop?.enabled ? canvasLength(backdrop.radius) : canvasLength(recipe.borderRadius), backgroundColor: backdrop?.enabled ? colorWithOpacity(backdrop.color, backdrop.opacity) : recipe.backgroundOpacity > 0 ? `rgb(17 19 22 / ${recipe.backgroundOpacity})` : undefined, backdropFilter: backdrop?.enabled && backdrop.blur > 0 ? `blur(${canvasLength(backdrop.blur)})` : undefined, "--effect-accent": effect.accentColor, "--effect-speed": `${0.45 / effect.speed}s` } as React.CSSProperties)}>{recipe.chart
              ? <EffectChartCanvas spec={recipe.chart} caption={effect.text} textColor={effect.color} accentColor={effect.accentColor} fontSize={effect.fontSize} progress={chartProgressFor(recipe, effect.startUs, effect.speed)} cssWidth={`${measureChartBox(recipe.chart, effect.fontSize).width / project.canvas.width * 100}cqw`} />
              : <span>{effect.text}</span>}</InteractiveEffectOverlay>;
          })}
          {project.chapterProgress.enabled && project.chapterProgress.chapters.length > 0 && <div className="chapter-progress-overlay" style={{ height: canvasLength(project.chapterProgress.height, 18), backgroundColor: colorWithOpacity(project.chapterProgress.backgroundColor, 0.9), color: project.chapterProgress.textColor }}>{project.chapterProgress.chapters.map((chapter, index) => <div key={chapter.id} className={`chapter-progress-item ${index === chapterState.activeIndex ? "active" : ""} ${index < chapterState.activeIndex ? "completed" : ""}`} style={{ "--chapter-accent": project.chapterProgress.activeColor, "--chapter-fill": `${index === chapterState.activeIndex ? chapterState.localProgress * 100 : index < chapterState.activeIndex ? 100 : 0}%` } as React.CSSProperties}><span>{chapter.title}</span></div>)}</div>}
          {subtitle && activeSubtitleStyle && <div className={`subtitle-overlay preset-${activeSubtitleStyle.stylePreset}`} style={{ bottom: `${100 - subtitle.positionY}%`, color: subtitle.color, backgroundColor: colorWithOpacity(subtitle.backgroundColor, activeSubtitleStyle.stylePreset === "minimal" ? 0 : activeSubtitleStyle.backgroundOpacity), borderRadius: canvasLength(activeSubtitleStyle.borderRadius), fontSize: canvasLength(subtitle.fontSize, 9), WebkitTextStroke: activeSubtitleStyle.outlineWidth > 0 ? `${canvasLength(activeSubtitleStyle.outlineWidth)} ${activeSubtitleStyle.outlineColor}` : undefined }}>{highlightedTextParts(displaySubtitleText(subtitle.text), activeSubtitleStyle.highlightWords).map((part, index) => <span key={`${index}-${part.text}`} className={part.highlighted ? "subtitle-highlight" : undefined} style={part.highlighted ? { color: activeSubtitleStyle.highlightColor } : undefined}>{part.text}</span>)}</div>}
          {!hasContent && <div className="empty-canvas"><strong>从任意内容开始</strong><p>导入视频或音频，也可以直接生成 AI 内容。</p><div><button className="button secondary" onClick={onImport}><FileVideo2 size={16} />导入媒体</button><button className="button primary" onClick={onGenerate}><Sparkles size={16} />AI 生成</button></div></div>}
        </div>
      </div>
      <CanvasSettingsDialog open={canvasSettingsOpen} onOpenChange={setCanvasSettingsOpen} canvas={project.canvas} assets={project.assets} />
      <ChapterProgressDialog open={chapterSettingsOpen} onOpenChange={setChapterSettingsOpen} />
    </section>
  );
}

function SyncedVideo({ src, sourceInUs, localUs, playbackRate, volume, muted, fit, camera, cameraStartOffsetUs, cameraDurationUs, focus, contentFocus = { x: 50, y: 50 }, playing, loopDurationUs, className = "video-content", onSelect }: { src: string; sourceInUs: number; localUs: number; playbackRate: number; volume: number; muted: boolean; fit: "cover" | "contain"; camera: CameraMotion; cameraStartOffsetUs: number; cameraDurationUs: number; focus?: VideoClip["focus"]; contentFocus?: VideoTargetPoint; playing: boolean; loopDurationUs?: number; className?: string; onSelect?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const playbackGate = useRef(createMediaPlaybackGate());
  const wasPlaying = useRef(false);
  const targetTime = previewMediaTimeSeconds(sourceInUs, localUs, playbackRate, loopDurationUs);
  const cameraState = cameraStateAt(camera, (localUs - cameraStartOffsetUs) / Math.max(1, cameraDurationUs));
  const focusAmount = focus ? focusEnvelope(focus, localUs) : 0;
  const focusScale = 1 + ((focus?.zoom ?? 1) - 1) * focusAmount;
  const combinedScale = cameraState.scale * focusScale;
  const focusX = ((focus?.x ?? 50) - 50) * 2 * focusAmount;
  const focusY = ((focus?.y ?? 50) - 50) * 2 * focusAmount;
  const cameraTranslateX = -(cameraState.x + focusX) * Math.max(0, combinedScale - 1) / 2;
  const cameraTranslateY = -(cameraState.y + focusY) * Math.max(0, combinedScale - 1) / 2;
  const sync = (forceSeek = false) => {
    const video = ref.current;
    if (!video) return;
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA && (forceSeek || mediaNeedsSeek(video.currentTime, targetTime, playing, 0.65))) video.currentTime = targetTime;
    video.playbackRate = playbackRate;
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = muted;
    syncMediaPlayback(video, playing, playbackGate.current);
  };
  useEffect(() => {
    const justStarted = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    sync(justStarted);
  }, [muted, playbackRate, playing, targetTime, volume]);
  useEffect(() => () => {
    playbackGate.current.desired = false;
    const video = ref.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }, []);
  const metadataReady = () => {
    playbackGate.current.failed = false;
    sync(true);
  };
  const canPlay = () => {
    playbackGate.current.failed = false;
    sync(false);
  };
  return <div className={className ?? "video-content"} onPointerDown={onSelect ? (event) => { event.stopPropagation(); onSelect(); } : undefined}><video ref={ref} src={src} muted={muted} playsInline preload="auto" loop={Boolean(loopDurationUs)} onLoadedMetadata={metadataReady} onCanPlay={canPlay} style={{ objectFit: fit, objectPosition: `${contentFocus.x}% ${contentFocus.y}%`, transform: `translate(${cameraTranslateX}%, ${cameraTranslateY}%) scale(${combinedScale})` }} /></div>;
}

function AudioPreview({ clip, src, playheadUs, playing, ducked }: { clip: AudioClip; src: string; playheadUs: number; playing: boolean; ducked: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const playbackGate = useRef(createMediaPlaybackGate());
  const wasPlaying = useRef(false);
  const localUs = playheadUs - clip.startUs;
  const targetTime = previewMediaTimeSeconds(clip.sourceInUs, localUs, clip.playbackRate);
  const sync = (forceSeek = false) => {
    const audio = ref.current;
    if (!audio) return;
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && (forceSeek || mediaNeedsSeek(audio.currentTime, targetTime, playing, 0.9))) audio.currentTime = targetTime;
    audio.playbackRate = clip.playbackRate;
    const fadeInGain = clip.fadeInUs > 0 ? Math.min(1, localUs / clip.fadeInUs) : 1;
    const remainingUs = clip.durationUs - localUs;
    const fadeOutGain = clip.fadeOutUs > 0 ? Math.min(1, remainingUs / clip.fadeOutUs) : 1;
    audio.volume = Math.min(1, clip.volume * Math.max(0, Math.min(fadeInGain, fadeOutGain)) * (ducked ? 0.28 : 1));
    syncMediaPlayback(audio, playing, playbackGate.current);
  };
  useEffect(() => {
    const justStarted = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    sync(justStarted);
  }, [clip.fadeInUs, clip.fadeOutUs, clip.playbackRate, clip.volume, ducked, localUs, playing, targetTime]);
  useEffect(() => () => {
    playbackGate.current.desired = false;
    const audio = ref.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);
  const metadataReady = () => {
    playbackGate.current.failed = false;
    sync(true);
  };
  const canPlay = () => {
    playbackGate.current.failed = false;
    sync(false);
  };
  return <audio ref={ref} src={src} preload="auto" onLoadedMetadata={metadataReady} onCanPlay={canPlay} />;
}
