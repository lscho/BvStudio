import { isShotcraftComposition, shotcraftOwnsSubtitle, shotcraftRenderData } from "@/domain/shotcraft";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CompositionScene } from "@/components/CompositionScene";
import { compositionLayer, compositionTimeUs, compositionTransformPatch, isBackgroundComposition, mediaComposition } from "@/domain/compositions";
import { DEFAULT_VIDEO_LAYER, normalizeLayer } from "@/domain/layers";
import { videoFrameSize } from "@/domain/videoFrame";
import { Crosshair, FileVideo2, ListTree, Play, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { CanvasSettingsDialog } from "@/components/CanvasSettingsDialog";
import { PresenterSafeAreaOverlay } from "@/components/PresenterSafeAreaOverlay";
import { ChapterProgressDialog } from "@/components/ChapterProgressDialog";
import { contentEndUs, type AudioClip, type CompositionClip, type GeneratedBlock, type ImageClip, type MediaAsset, type SceneClip, type SubtitleClip, type VideoClip } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { clockControlledRecipe, effectAnimationState, compositionById, effectiveEffectFontSize, type EffectRecipe, type SceneBackgroundSpec } from "@/domain/effects";
import { CompositionContent, effectCardChromeStyle, reactEffectMotionDurationUs, usesComponentChrome, usesFullCanvasComposition } from "@/compositions/registry";
import { createEffectPreviewModel } from "@/domain/effectPreview";
import { focusCardMediaRect, focusCardSourceRect } from "@/domain/focusCard";
import { resolveEffectAppearance } from "@/domain/motionTheme";
import { cameraMotionForPreset, cameraStateAt, type CameraMotion } from "@/domain/camera";
import { upsertVisualKeyframe, visualTransformAt } from "@/domain/transforms";
import { createMediaPlaybackGate, mediaNeedsSeek, previewMediaTimeSeconds, syncMediaPlayback } from "@/domain/playback";
import { activeVideoPresentationCue, focusEnvelope, momentumExitTransition, momentumTransitionVisualState, transitionEnvelope, videoFocus, videoPresentationAt, videoTransition, visualTransition } from "@/domain/videoPresentation";
import { chapterProgressAt, displaySubtitleText, highlightedTextParts, subtitleStyle } from "@/domain/videoDecorations";
import { localMediaUrl } from "@/services/media";
import type { AiProviderConfig } from "@/services/ai/provider";
import { resolveOverlayStudioMediaParams } from "@/domain/overlayStudioMedia";
import { isReferenceStageComposition, referenceStageInteractionPatch, referenceStageOuterTransform } from "@/domain/overlayStudioReference";

interface Props {
  aiProvider: AiProviderConfig;
  onNeedSettings: () => void;
  onImport: () => void;
  onGenerate: () => void;
  playing: boolean;
  effectPreview?: { compositionId: string; requestId: number } | null;
  onCloseEffectPreview?: () => void;
}

function activeAt<T extends { startUs: number; durationUs: number }>(clips: T[], timeUs: number) {
  return clips.find((clip) => timeUs >= clip.startUs && timeUs < clip.startUs + clip.durationUs);
}

type EffectTransform = CompositionClip["transform"];
type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type ScreenPoint = { x: number; y: number };
type InteractionBounds = { left: number; top: number; width: number; height: number };

const resizeHandles: readonly ResizeHandle[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const overlayContentBoundsSelector = "[data-overlay-content-root] > *";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function previewCanvasLength(pixels: number, canvasWidth: number, minimum = 0) {
  return minimum > 0
    ? `clamp(${minimum}px, ${pixels / canvasWidth * 100}cqw, ${pixels}px)`
    : `${pixels / canvasWidth * 100}cqw`;
}

function effectLibraryPreviewDurationUs(compositionId: string) {
  const definition = compositionById(compositionId);
  if (mediaComposition(compositionId)) return Math.min(definition.defaultDurationUs, 4_000_000);
  if (isShotcraftComposition(compositionId)) return definition.defaultDurationUs;
  return Math.min(definition.defaultDurationUs, 5_000_000, Math.max(1_500_000, reactEffectMotionDurationUs(compositionId)));
}

function effectMediaParams(clip: CompositionClip, assets: readonly MediaAsset[]) {
  return resolveOverlayStudioMediaParams(clip.compositionId, clip.params, clip.bindings, (assetId) => {
    const asset = assets.find((candidate) => candidate.id === assetId);
    const url = asset?.proxyObjectUrl ?? asset?.objectUrl;
    return asset && url && asset.kind !== "audio" ? { id: asset.id, kind: asset.kind, url } : undefined;
  });
}

export function previewAudioGain(volume: number, fadeInGain: number, fadeOutGain: number, ducked: boolean) {
  return clamp(volume, 0, 2) * clamp(Math.min(fadeInGain, fadeOutGain), 0, 1) * (ducked ? 0.28 : 1);
}

export function previewNativeAudioVolume(volume: number, fadeInGain: number, fadeOutGain: number, ducked: boolean) {
  return Math.min(1, previewAudioGain(volume, fadeInGain, fadeOutGain, ducked));
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

export function resizeEffectTransform(transform: EffectTransform, handle: ResizeHandle, deltaX: number, deltaY: number, width: number, height: number, sensitivity = 3): EffectTransform {
  const horizontal = handle.includes("e") ? deltaX / Math.max(1, width) : handle.includes("w") ? -deltaX / Math.max(1, width) : 0;
  const vertical = handle.includes("s") ? deltaY / Math.max(1, height) : handle.includes("n") ? -deltaY / Math.max(1, height) : 0;
  const axes = Number(handle.includes("e") || handle.includes("w")) + Number(handle.includes("n") || handle.includes("s"));
  return { ...transform, scale: clamp(transform.scale * (1 + (horizontal + vertical) / Math.max(1, axes) * sensitivity), 0.3, 3) };
}

export function interactionBoundsFromScreenPoints(points: readonly ScreenPoint[], origin: ScreenPoint, xAxis: ScreenPoint, yAxis: ScreenPoint): InteractionBounds | null {
  if (!points.length) return null;
  const ax = xAxis.x - origin.x;
  const ay = xAxis.y - origin.y;
  const bx = yAxis.x - origin.x;
  const by = yAxis.y - origin.y;
  const determinant = ax * by - ay * bx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) return null;
  const local = points.map((point) => {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return {
      x: (dx * by - dy * bx) / determinant,
      y: (dy * ax - dx * ay) / determinant
    };
  });
  if (local.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
  const left = Math.min(...local.map((point) => point.x));
  const right = Math.max(...local.map((point) => point.x));
  const top = Math.min(...local.map((point) => point.y));
  const bottom = Math.max(...local.map((point) => point.y));
  if (right - left < 1 || bottom - top < 1) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export function anchorContentResizeTransform(start: EffectTransform, resized: EffectTransform, handle: ResizeHandle, content: InteractionBounds, canvas: InteractionBounds): EffectTransform {
  const ratio = resized.scale / Math.max(0.000001, start.scale);
  const horizontalDirection = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const verticalDirection = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  const contentCenterX = content.left + content.width / 2;
  const contentCenterY = content.top + content.height / 2;
  const anchorX = canvas.left + canvas.width * start.x / 100;
  const anchorY = canvas.top + canvas.height * start.y / 100;
  const desiredCenterX = contentCenterX + horizontalDirection * content.width * (ratio - 1) / 2;
  const desiredCenterY = contentCenterY + verticalDirection * content.height * (ratio - 1) / 2;
  const scaledCenterX = anchorX + (contentCenterX - anchorX) * ratio;
  const scaledCenterY = anchorY + (contentCenterY - anchorY) * ratio;
  return {
    ...resized,
    x: clamp(start.x + (desiredCenterX - scaledCenterX) / Math.max(1, canvas.width) * 100, 0, 100),
    y: clamp(start.y + (desiredCenterY - scaledCenterY) / Math.max(1, canvas.height) * 100, 0, 100)
  };
}

function elementScreenPoints(element: HTMLElement): ScreenPoint[] {
  const boxQuadElement = element as HTMLElement & { getBoxQuads?: () => readonly { p1: ScreenPoint; p2: ScreenPoint; p3: ScreenPoint; p4: ScreenPoint }[] };
  const quad = boxQuadElement.getBoxQuads?.()[0];
  if (quad) return [quad.p1, quad.p2, quad.p3, quad.p4];
  const bounds = element.getBoundingClientRect();
  return [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ];
}

function sameInteractionBounds(left: InteractionBounds | null, right: InteractionBounds | null) {
  if (!left || !right) return left === right;
  return Math.abs(left.left - right.left) < 0.25
    && Math.abs(left.top - right.top) < 0.25
    && Math.abs(left.width - right.width) < 0.25
    && Math.abs(left.height - right.height) < 0.25;
}

export function videoTargetPoint(clientX: number, clientY: number, bounds: Pick<DOMRect, "left" | "top" | "width" | "height">): VideoTargetPoint {
  return {
    x: clamp((clientX - bounds.left) / Math.max(1, bounds.width) * 100, 0, 100),
    y: clamp((clientY - bounds.top) / Math.max(1, bounds.height) * 100, 0, 100)
  };
}

function InteractiveEffectOverlay({ className, transform, selected, locked = false, contentBoundsSelector, styleFor, onSelect, onCommit, children }: {
  className: string;
  transform: EffectTransform;
  selected: boolean;
  locked?: boolean;
  contentBoundsSelector?: string;
  styleFor: (transform: EffectTransform) => React.CSSProperties;
  onSelect: () => void;
  onCommit: (transform: EffectTransform) => void;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<EffectTransform | null>(null);
  const [contentBounds, setContentBounds] = useState<InteractionBounds | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const originMarkerRef = useRef<HTMLSpanElement>(null);
  const xMarkerRef = useRef<HTMLSpanElement>(null);
  const yMarkerRef = useRef<HTMLSpanElement>(null);
  const gesture = useRef<null | { pointerId: number; handle: ResizeHandle | null; startX: number; startY: number; start: EffectTransform; canvasBounds: InteractionBounds; resizeBounds: InteractionBounds | null; resizeWidth: number; resizeHeight: number; resizeSensitivity: number; latest: EffectTransform }>(null);
  const liveTransform = draft ?? transform;

  useLayoutEffect(() => {
    if (!contentBoundsSelector) {
      setContentBounds(null);
      return;
    }
    const overlay = overlayRef.current;
    const originMarker = originMarkerRef.current;
    const xMarker = xMarkerRef.current;
    const yMarker = yMarkerRef.current;
    if (!overlay || !originMarker || !xMarker || !yMarker) return;
    const measure = () => {
      const target = overlay.querySelector<HTMLElement>(contentBoundsSelector);
      if (!target) return;
      const originRect = originMarker.getBoundingClientRect();
      const xRect = xMarker.getBoundingClientRect();
      const yRect = yMarker.getBoundingClientRect();
      const next = interactionBoundsFromScreenPoints(elementScreenPoints(target),
        { x: originRect.left, y: originRect.top },
        { x: xRect.left, y: xRect.top },
        { x: yRect.left, y: yRect.top });
      setContentBounds((current) => sameInteractionBounds(current, next) ? current : next);
    };
    measure();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(overlay);
    const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutationObserver?.observe(overlay, { attributes: true, characterData: true, childList: true, subtree: true });
    window.addEventListener("resize", measure);
    const animationFrame = typeof requestAnimationFrame === "function" ? requestAnimationFrame(measure) : 0;
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", measure);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [contentBoundsSelector]);

  function startGesture(event: React.PointerEvent, handle: ResizeHandle | null) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    if (locked) return;
    const canvas = overlayRef.current?.closest(".preview-canvas");
    if (!(canvas instanceof HTMLElement) || !overlayRef.current) return;
    const bounds = canvas.getBoundingClientRect();
    const selectionBounds = handle ? selectionRef.current?.getBoundingClientRect() : null;
    const canvasBounds = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
    gesture.current = {
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      start: transform,
      canvasBounds,
      resizeBounds: selectionBounds ? { left: selectionBounds.left, top: selectionBounds.top, width: selectionBounds.width, height: selectionBounds.height } : null,
      resizeWidth: selectionBounds?.width ?? bounds.width,
      resizeHeight: selectionBounds?.height ?? bounds.height,
      resizeSensitivity: selectionBounds ? 1 : 3,
      latest: transform
    };
    setDraft(transform);
    overlayRef.current.setPointerCapture(event.pointerId);
  }

  function continueGesture(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    let next = active.handle
      ? resizeEffectTransform(active.start, active.handle, deltaX, deltaY, active.resizeWidth, active.resizeHeight, active.resizeSensitivity)
      : moveEffectTransform(active.start, deltaX, deltaY, active.canvasBounds.width, active.canvasBounds.height);
    if (active.handle && active.resizeBounds) next = anchorContentResizeTransform(active.start, next, active.handle, active.resizeBounds, active.canvasBounds);
    active.latest = next;
    setDraft(next);
  }

  function finishGesture(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDraft(null);
    if (!locked) onCommit(active.latest);
  }

  return (
    <div
      ref={overlayRef}
      className={`${className} ${contentBoundsSelector ? "content-bounded-overlay" : ""} ${selected ? "selected" : ""} ${draft ? "manipulating" : ""}`}
      data-interaction-bounds={contentBoundsSelector ? "content" : "canvas"}
      style={{ ...styleFor(liveTransform), "--handle-scale": 1 / liveTransform.scale } as React.CSSProperties}
      onPointerDown={contentBoundsSelector ? undefined : (event) => startGesture(event, null)}
      onPointerMove={continueGesture}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      {children}
      {contentBoundsSelector && <>
        <span ref={originMarkerRef} className="effect-coordinate-marker marker-origin" />
        <span ref={xMarkerRef} className="effect-coordinate-marker marker-x" />
        <span ref={yMarkerRef} className="effect-coordinate-marker marker-y" />
        {contentBounds && <div
          ref={selectionRef}
          className={`effect-selection-bounds ${selected ? "selected" : ""}`}
          style={{ left: contentBounds.left, top: contentBounds.top, width: contentBounds.width, height: contentBounds.height }}
          onPointerDown={(event) => startGesture(event, null)}
        >
          {selected && !locked && resizeHandles.map((handle) => (
            <i key={handle} className={`canvas-resize-handle handle-${handle}`} aria-hidden="true" onPointerDown={(event) => startGesture(event, handle)} />
          ))}
        </div>}
      </>}
      {!contentBoundsSelector && selected && !locked && resizeHandles.map((handle) => (
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

export function PreviewCanvas({ aiProvider, onNeedSettings, onImport, onGenerate, playing, effectPreview, onCloseEffectPreview }: Props) {
  const [canvasSettingsOpen, setCanvasSettingsOpen] = useState(false);
  const [chapterSettingsOpen, setChapterSettingsOpen] = useState(false);
  const [showPresenterSafeArea, setShowPresenterSafeArea] = useState(false);
  const [effectPreviewTimeUs, setEffectPreviewTimeUs] = useState(0);
  const project = useEditorStore((state) => state.project);
  const playheadUs = useEditorStore((state) => state.playheadUs);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const updateComposition = useEditorStore((state) => state.updateComposition);
  const updatePresenterSafeArea = useEditorStore((state) => state.updatePresenterSafeArea);
  const updateVideo = useEditorStore((state) => state.updateVideo);
  const updateVideoPresentationCue = useEditorStore((state) => state.updateVideoPresentationCue);
  const focusPickClipId = useEditorStore((state) => state.focusPickClipId);
  const setFocusPickClip = useEditorStore((state) => state.setFocusPickClip);
  const presenterConfigured = project.presenterSafeArea.position !== "none";
  const presenterEditing = showPresenterSafeArea && presenterConfigured && !playing && !effectPreview && !focusPickClipId;
  const presenterButtonLabel = !presenterConfigured ? "设置人物避让区" : showPresenterSafeArea ? "清除人物避让区" : "显示人物避让框";
  function togglePresenterArea() {
    if (!presenterConfigured) {
      updatePresenterSafeArea({ position: "center", widthPercent: project.presenterSafeArea.widthPercent });
      setShowPresenterSafeArea(true);
    } else if (showPresenterSafeArea) clearPresenterArea();
    else setShowPresenterSafeArea(true);
    setFocusPickClip(null);
  }
  function clearPresenterArea() {
    updatePresenterSafeArea({ position: "none", widthPercent: project.presenterSafeArea.widthPercent });
  }
  const previewDefinition = effectPreview ? compositionById(effectPreview.compositionId) : null;
  const previewModel = useMemo(() => effectPreview ? createEffectPreviewModel(effectPreview.compositionId, project.motionTheme, project.assets) : null, [effectPreview, project.assets, project.motionTheme]);
  const previewClip = previewModel?.clip ?? null;
  const showTimelineGraphics = !effectPreview || isBackgroundComposition(effectPreview.compositionId) || Boolean(previewClip?.recipe?.sceneBackground);
  useEffect(() => {
    if (!effectPreview) return;
    const durationUs = effectLibraryPreviewDurationUs(effectPreview.compositionId);
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof requestAnimationFrame !== "function") {
      setEffectPreviewTimeUs(durationUs);
      return;
    }
    let animationFrame = 0;
    const startedAt = performance.now();
    setEffectPreviewTimeUs(0);
    const tick = (now: number) => {
      const nextTimeUs = Math.min(durationUs, Math.max(0, (now - startedAt) * 1_000));
      setEffectPreviewTimeUs(nextTimeUs);
      if (nextTimeUs < durationUs) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [effectPreview]);
  const clipIndex = useMemo(() => {
    const visibleTracks = project.tracks.filter((track) => !track.hidden);
    const clips = visibleTracks.flatMap((track) => track.clips);
    return {
      clips,
      videos: clips.filter((clip): clip is VideoClip => clip.kind === "video"),
      generated: clips.filter((clip): clip is GeneratedBlock => clip.kind === "generated"),
      scenes: clips.filter((clip): clip is SceneClip => clip.kind === "scene"),
      effects: clips.filter((clip): clip is CompositionClip => clip.kind === "composition"),
      images: clips.filter((clip): clip is ImageClip => clip.kind === "image"),
      subtitles: clips.filter((clip): clip is SubtitleClip => clip.kind === "subtitle"),
      audio: visibleTracks.filter((track) => track.kind === "audio" && !track.muted).flatMap((track) => track.clips).filter((clip): clip is AudioClip => clip.kind === "audio")
    };
  }, [project]);
  const activeVideos = clipIndex.videos.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs).sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0));
  const visualClips = [...clipIndex.videos, ...clipIndex.images];
  const generated = activeAt(clipIndex.generated, playheadUs);
  const activeScenes = clipIndex.scenes.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const activeEffects = clipIndex.effects.filter((clip) => playheadUs >= clip.startUs && playheadUs < clip.startUs + clip.durationUs);
  const shotcraftOwnsActiveSubtitle = activeEffects.some((effect) => isShotcraftComposition(effect.compositionId) && shotcraftOwnsSubtitle(effect));
  const focusCardSourceVideoIds = new Set(activeEffects.filter((effect) => showTimelineGraphics && effect.compositionId === "focus-card").flatMap((effect) => {
    const assetId = effect.bindings?.find((binding) => binding.slotId === "presenter")?.assetIds[0];
    const source = activeVideos.find((video) => video.assetId === assetId);
    return source ? [source.id] : [];
  }));
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
  const canvasLength = (pixels: number, minimum = 0) => previewCanvasLength(pixels, project.canvas.width, minimum);
  const animatedStyle = (recipe: EffectRecipe, transform: CompositionClip["transform"], startUs: number, speed: number, transitionState: { scale?: number; translateX?: number; opacity?: number; blur?: number } = {}, clockUs = playheadUs) => {
    const animation = effectAnimationState(recipe, Math.max(0, clockUs - startUs), speed);
    const tilt = (animation.rotateX || animation.rotateY)
      ? ` ${animation.perspective >= 100 ? `perspective(${Math.min(4000, animation.perspective)}px)` : "perspective(1000px)"} rotateX(${animation.rotateX}deg) rotateY(${animation.rotateY}deg)`
      : "";
    return {
      opacity: transform.opacity * (transitionState.opacity ?? 1),
      filter: transitionState.blur && transitionState.blur > 0.01 ? `blur(${transitionState.blur / 1920 * 100}cqw)` : undefined,
      transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) translateX(${transitionState.translateX ?? 0}%) scale(${transform.scale * animation.scale * (transitionState.scale ?? 1)}) rotate(${transform.rotation + animation.rotation}deg)${tilt}`
    };
  };
  const previewRecipe = previewClip && previewDefinition ? clockControlledRecipe(previewClip.recipe ?? previewDefinition.recipe) : null;
  const previewAppearance = previewClip ? resolveEffectAppearance(previewClip, project.motionTheme) : null;
  const renderFocusCardMedia = (effect: CompositionClip, assets: typeof project.assets, localUs: number) => {
    if (effect.compositionId !== "focus-card") return null;
    const assetId = effect.bindings?.find((binding) => binding.slotId === "presenter")?.assetIds[0];
    const asset = assets.find((candidate) => candidate.id === assetId);
    const src = asset?.proxyObjectUrl ?? asset?.objectUrl;
    if (!asset || !src) return null;
    const animationTimeUs = compositionTimeUs(effect, localUs);
    const transform = visualTransformAt(effect.transform, effect.transformKeyframes, localUs);
    const sourceClip = clipIndex.videos.find((candidate) => candidate.assetId === asset.id && playheadUs >= candidate.startUs && playheadUs < candidate.startUs + candidate.durationUs);
    const sourceLocalUs = sourceClip ? Math.max(0, playheadUs - sourceClip.startUs) : animationTimeUs;
    const presentation = sourceClip ? videoPresentationAt(sourceClip, sourceLocalUs) : null;
    const sourceStartLocalUs = sourceClip ? Math.max(0, (effect.id.startsWith("effect-library-preview:") ? playheadUs : effect.startUs) - sourceClip.startUs) : 0;
    const sourceStartPresentation = sourceClip ? videoPresentationAt(sourceClip, sourceStartLocalUs) : null;
    const sourceRect = sourceStartPresentation ? focusCardSourceRect(sourceStartPresentation.transform, sourceStartPresentation.mask.shape, sourceStartPresentation.mask.radius, project.canvas.width, project.canvas.height, videoFrameSize(sourceStartPresentation.mask, project.canvas.width, project.canvas.height, asset.width, asset.height)) : undefined;
    const rect = focusCardMediaRect(effect.params, project.canvas.width, project.canvas.height, animationTimeUs, sourceRect);
    const imageDemo = src.startsWith("data:image/");
    return <div key={`focus-media:${effect.id}`} className="focus-card-linked-media" aria-hidden="true" style={{ left: `${transform.x}%`, top: `${transform.y}%`, zIndex: compositionLayer(effect) + 1, opacity: transform.opacity, transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)` }}>
      <div className="focus-card-media-frame" style={{ left: `${rect.x / project.canvas.width * 100}%`, top: `${rect.y / project.canvas.height * 100}%`, width: `${rect.width / project.canvas.width * 100}%`, height: `${rect.height / project.canvas.height * 100}%`, borderRadius: `${rect.radius / project.canvas.width * 100}cqw`, borderColor: effect.accentColor }}>
        {imageDemo ? <img src={src} alt="" /> : <SyncedVideo
          src={src}
          sourceInUs={sourceClip?.sourceInUs ?? 0}
          localUs={sourceLocalUs}
          playbackRate={sourceClip?.playbackRate ?? 1}
          volume={0}
          muted
          fit={presentation?.fit ?? "cover"}
          camera={presentation?.camera ?? cameraMotionForPreset("none")}
          cameraStartOffsetUs={presentation?.cameraStartOffsetUs ?? 0}
          cameraDurationUs={presentation?.cameraDurationUs ?? Math.max(1, effect.durationUs)}
          contentFocus={presentation ? { x: presentation.mask.focusX, y: presentation.mask.focusY } : undefined}
          playing={playing}
          loopDurationUs={sourceClip ? undefined : asset.durationUs}
          className="focus-card-media-content"
        />}
      </div>
    </div>;
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
      <div className={`preview-toolbar ${effectPreview ? "effect-preview-active" : ""}`}>{effectPreview && previewDefinition ? <><span className="effect-preview-label"><Play size={12} fill="currentColor" aria-hidden="true" /><span>预览 · {previewDefinition.name}</span></span><button type="button" aria-label="关闭动效预览" title="关闭预览" onClick={onCloseEffectPreview}><X size={13} /></button></> : <><span>{project.canvas.width} × {project.canvas.height}</span><span>{Number((project.canvas.fpsNumerator / project.canvas.fpsDenominator).toFixed(3))} fps</span><button type="button" className={presenterConfigured ? "active" : ""} aria-label={presenterButtonLabel} aria-pressed={presenterConfigured} title={presenterButtonLabel} disabled={playing} onClick={togglePresenterArea}><UserRound size={13} /></button><button type="button" aria-label="设置章节进度" title="顶部章节进度" onClick={() => setChapterSettingsOpen(true)}><ListTree size={13} /></button><button type="button" aria-label="设置画布" title="画布与输出规格" onClick={() => setCanvasSettingsOpen(true)}><Settings2 size={13} /></button></>}</div>
      <div className="canvas-wrap">
        <div className={`preview-canvas ${!hasContent && !effectPreview ? "empty-preview" : ""} ${focusPickClipId ? "picking-focus" : ""}`} onPointerDownCapture={pickFocus} data-orientation={canvasRatioNumber < 0.8 ? "portrait" : canvasRatioNumber < 1.2 ? "square" : "landscape"} style={{ aspectRatio: canvasRatio, "--canvas-ratio": canvasRatioNumber } as React.CSSProperties}>
          {activeAudio.map((clip) => {
            const audioAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            return audioAsset?.objectUrl ? <AudioPreview key={clip.id} clip={clip} src={audioAsset.objectUrl} playheadUs={playheadUs} playing={playing} ducked={voiceActive && clip.role === "music"} /> : null;
          })}
          {activeEffectSounds.map(({ clip, sourcePath }) => <AudioPreview key={clip.id} clip={clip} src={localMediaUrl(sourcePath)} playheadUs={playheadUs} playing={playing} ducked={false} />)}
          {visibleScenes.map((scene) => <div key={scene.id} className="scene-background" style={{ ...sceneBackgroundStyle(scene.background), opacity: scene.opacity * (scene.dimAtUs !== undefined && playheadUs - scene.startUs >= scene.dimAtUs ? 0.35 : 1) }} />)}
          {generated && !activeVideos.length && !visibleScenes.length && !foregroundEffects.some(effect => effect.recipe?.sceneBackground) && <div className="generated-background" />}
          {activeVideos.filter((video) => !focusCardSourceVideoIds.has(video.id)).map((video) => {
            const videoAsset = project.assets.find((candidate) => candidate.id === video.assetId);
            const src = videoAsset?.proxyObjectUrl ?? videoAsset?.objectUrl;
            if (!src) return null;
            const localUs = playheadUs - video.startUs;
            const presentation = videoPresentationAt(video, localUs);
            const transform = presentation.transform;
            const mask = presentation.mask;
            const baseTransition = videoTransition(video);
            const transition = video.presentationCues?.length && baseTransition.preset !== "momentum-zoom" ? { ...baseTransition, preset: "none" as const } : baseTransition;
            const exitTransition = momentumExitTransition(video, visualClips);
            const momentum = momentumTransitionVisualState(video, localUs, exitTransition);
            const frame = videoFrameSize(mask, project.canvas.width, project.canvas.height, videoAsset?.width, videoAsset?.height);
            const locked = video.locked || Boolean(project.tracks.find((track) => track.id === video.trackId)?.locked);
            const transitionProgress = transitionEnvelope(video, localUs);
            const transitionX = transition.preset === "slide-left" ? (1 - transitionProgress) * 100 : transition.preset === "slide-right" ? (transitionProgress - 1) * 100 : 0;
            const transitionScale = transition.preset === "zoom"
              ? 0.72 + transitionProgress * 0.28
              : transition.preset === "dock" && !video.transformKeyframes?.length ? 0.15 + transitionProgress * 0.85 : 1;
            const clipPath = mask.shape === "circle" ? "circle(50% at 50% 50%)" : mask.shape === "ellipse" ? "ellipse(50% 50% at 50% 50%)" : mask.shape === "portrait" ? "inset(0 34.18%)" : undefined;
            return <InteractiveEffectOverlay key={video.id} className="video-layer" transform={transform} selected={selectedClipId === video.id} locked={locked} onSelect={() => selectClip(video.id)} onCommit={(nextTransform) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { transform: nextTransform }) : updateVideo(video.id, video.transformKeyframes?.length ? { transformKeyframes: upsertVisualKeyframe(video.transformKeyframes, localUs, nextTransform), layoutPreset: "custom" } : { transform: nextTransform, layoutPreset: "custom" })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, width: `${frame.width / project.canvas.width * 100}%`, height: `${frame.height / project.canvas.height * 100}%`, zIndex: normalizeLayer(video.zIndex, DEFAULT_VIDEO_LAYER), opacity: nextTransform.opacity * (transition.preset === "fade" || transition.preset === "circle-reveal" ? transitionProgress : 1), clipPath, borderRadius: mask.shape === "circle" ? "50%" : mask.shape === "rounded" ? `${mask.radius}%` : undefined, border: mask.borderWidth > 0 ? `${canvasLength(mask.borderWidth, 1)} solid ${mask.borderColor}` : undefined, transform: `translate(-50%, -50%) translateX(${transitionX}%) scale(${nextTransform.scale * transitionScale * momentum.scale}) rotate(${nextTransform.rotation}deg)` })}>
              <SyncedVideo src={src} sourceInUs={video.sourceInUs} localUs={localUs} playbackRate={video.playbackRate} volume={video.volume} muted={videoAsset?.hasAudio === false || video.volume <= 0 || Boolean(project.tracks.find((track) => track.id === video.trackId)?.muted)} fit={presentation.fit} camera={presentation.camera} cameraStartOffsetUs={presentation.cameraStartOffsetUs} cameraDurationUs={presentation.cameraDurationUs} focus={presentation.focus} contentFocus={{ x: mask.focusX, y: mask.focusY }} transitionBlur={momentum.blur * 6} playing={playing} />
              {presentation.focus.enabled && focusEnvelope(presentation.focus, localUs) > 0 && <div className="video-focus-overlay" style={{ "--focus-x": `${presentation.focus.x}%`, "--focus-y": `${presentation.focus.y}%`, "--focus-radius": `${presentation.focus.radius}%`, "--focus-feather": `${presentation.focus.feather}%`, "--focus-dim": presentation.focus.dimOpacity } as React.CSSProperties}>{presentation.focus.showCursor && <i />}</div>}
              {selectedClipId === video.id && !locked && presentation.fit === "cover" && <VideoTargetHandle point={{ x: mask.focusX, y: mask.focusY }} kind="crop" onCommit={(point) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { mask: { ...mask, focusX: point.x, focusY: point.y } }) : updateVideo(video.id, { mask: { ...mask, focusX: point.x, focusY: point.y } })} />}
              {selectedClipId === video.id && presentation.focus.enabled && <VideoTargetHandle point={{ x: presentation.focus.x, y: presentation.focus.y }} kind="focus" onCommit={(point) => presentation.activeCueId ? updateVideoPresentationCue(video.id, presentation.activeCueId, { focus: { ...presentation.focus, x: point.x, y: point.y } }) : updateVideo(video.id, { focus: { ...presentation.focus, x: point.x, y: point.y } })} />}
            </InteractiveEffectOverlay>;
          })}
          {activeImages.map((clip) => {
            const imageAsset = project.assets.find((candidate) => candidate.id === clip.assetId);
            const transition = visualTransition(clip);
            const recipe = clockControlledRecipe({ layout: "frame", entrance: transition.preset === "none" ? clip.entrance : "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 });
            const localUs = playheadUs - clip.startUs;
            const progress = transitionEnvelope(clip, localUs);
            const exitTransition = momentumExitTransition(clip, visualClips);
            const momentum = momentumTransitionVisualState(clip, localUs, exitTransition);
            const transitionX = transition.preset === "slide-left" ? (1 - progress) * 100 : transition.preset === "slide-right" ? (progress - 1) * 100 : 0;
            const transitionScale = transition.preset === "zoom" ? 0.72 + progress * 0.28 : transition.preset === "dock" ? 0.15 + progress * 0.85 : 1;
            const transitionOpacity = transition.preset === "fade" || transition.preset === "circle-reveal" ? progress : 1;
            return imageAsset?.objectUrl ? <img key={clip.id} className={`image-overlay entrance-none ${selectedClipId === clip.id ? "selected" : ""}`} src={imageAsset.objectUrl} alt="" draggable={false} onPointerDown={(event) => { event.stopPropagation(); selectClip(clip.id); }} style={{ left: `${clip.transform.x}%`, top: `${clip.transform.y}%`, width: "30%", ...animatedStyle(recipe, clip.transform, clip.startUs, clip.speed, { scale: transitionScale * momentum.scale, translateX: transitionX, opacity: transitionOpacity, blur: momentum.blur * 6 }) }} /> : null;
          })}
          {showTimelineGraphics && foregroundEffects.filter((effect) => !effectPreview || !(isBackgroundComposition(effect.compositionId) || effect.recipe?.sceneBackground)).sort((left, right) => compositionLayer(left) - compositionLayer(right)).map((effect) => {
            if (effect.recipe?.sceneBackground) return <div key={effect.id} className="scene-background" style={{ ...sceneBackgroundStyle(effect.recipe.sceneBackground), zIndex: compositionLayer(effect), opacity: effect.transform.opacity * (effect.dimAtUs !== undefined && playheadUs - effect.startUs >= effect.dimAtUs ? .35 : 1) }} />;
            if (mediaComposition(effect.compositionId)) {
              const localUs = Math.max(0, Math.min(effect.durationUs, playheadUs - effect.startUs));
              const transform = visualTransformAt(effect.transform, effect.transformKeyframes, localUs);
              const locked = effect.locked || Boolean(project.tracks.find((track) => track.id === effect.trackId)?.locked);
              return <InteractiveEffectOverlay key={effect.id} className="composition-overlay" transform={transform} selected={selectedClipId === effect.id} locked={locked} onSelect={() => selectClip(effect.id)} onCommit={(next) => updateComposition(effect.id, compositionTransformPatch(effect, localUs, next))} styleFor={(next) => ({ left: `${next.x}%`, top: `${next.y}%`, zIndex: compositionLayer(effect), opacity: next.opacity, transform: `translate(-50%, -50%) scale(${next.scale}) rotate(${next.rotation}deg)` })}>
                <CompositionScene clip={effect} assets={project.assets} width={project.canvas.width} height={project.canvas.height} localUs={localUs} selected={selectedClipId === effect.id} onSelect={() => selectClip(effect.id)} />
              </InteractiveEffectOverlay>;
            }
            const recipe = clockControlledRecipe(effect.recipe ?? compositionById(effect.compositionId).recipe);
            const localUs = playheadUs - effect.startUs;
            const transform = visualTransformAt(effect.transform, effect.transformKeyframes, localUs);
            const fontSize = effectiveEffectFontSize(effect.fontSize, recipe, effect.text);
            const appearance = resolveEffectAppearance(effect, project.motionTheme);
            const themedEffect = { ...effect, ...appearance, fontSize };
            const dim = effect.dimAtUs !== undefined && localUs >= effect.dimAtUs ? 0.35 : 1;
            const fullCanvasComposition = usesFullCanvasComposition(effect.compositionId);
            const referenceStage = isReferenceStageComposition(effect.compositionId);
            const renderedTransform = referenceStage ? referenceStageOuterTransform(transform) : transform;
            const contentBounded = referenceStage && !isBackgroundComposition(effect.compositionId);
            return <InteractiveEffectOverlay key={effect.id} locked={effect.locked || Boolean(project.tracks.find((track) => track.id === effect.trackId)?.locked)} className={`effect-overlay react-effect ${fullCanvasComposition ? "reference-full-canvas-effect" : ""} component-${effect.compositionId} motion-${project.motionTheme.skin} style-${project.motionTheme.style} recipe-${recipe.layout} entrance-none`} transform={renderedTransform} selected={selectedClipId === effect.id} contentBoundsSelector={contentBounded ? overlayContentBoundsSelector : undefined} onSelect={() => selectClip(effect.id)} onCommit={(nextTransform) => updateComposition(effect.id, referenceStage
              ? referenceStageInteractionPatch(effect.params, nextTransform, project.canvas)
              : effect.transformKeyframes?.length
                ? { transformKeyframes: upsertVisualKeyframe(effect.transformKeyframes, localUs, nextTransform) }
                : { transform: nextTransform })} styleFor={(nextTransform) => ({ left: `${nextTransform.x}%`, top: `${nextTransform.y}%`, zIndex: compositionLayer(effect), ...effectCardChromeStyle(themedEffect, recipe, canvasLength, project.motionTheme, usesComponentChrome(effect.compositionId), fullCanvasComposition), ...animatedStyle(recipe, { ...nextTransform, opacity: nextTransform.opacity * dim }, effect.startUs - (effect.sourceOffsetUs ?? 0) / effect.speed, effect.speed), fontSize: canvasLength(fontSize) } as React.CSSProperties)}><CompositionContent shotcraftData={isShotcraftComposition(effect.compositionId) ? shotcraftRenderData(project, effect) : undefined} shotcraftAssets={project.assets} shotcraftTheme={project.motionTheme} compositionId={effect.compositionId} text={effect.text} color={appearance.color} accentColor={appearance.accentColor} fontSize={fontSize} recipe={recipe} params={effectMediaParams(effect, project.assets)} timeUs={compositionTimeUs(effect, localUs)} durationUs={effect.animationDurationUs ?? effect.durationUs} autoTiming={Boolean(effect.sourceSubtitleId)} canvasWidth={project.canvas.width} canvasHeight={project.canvas.height} /></InteractiveEffectOverlay>;
          })}
          {showTimelineGraphics && foregroundEffects.filter((effect) => effect.compositionId === "focus-card").map((effect) => renderFocusCardMedia(effect, project.assets, Math.max(0, Math.min(effect.durationUs, playheadUs - effect.startUs))))}
          {showTimelineGraphics && project.chapterProgress.enabled && project.chapterProgress.chapters.length > 0 && <div
            className={`chapter-progress-overlay position-${project.chapterProgress.position} style-${project.chapterProgress.style} ${project.chapterProgress.showTitles ? "" : "hide-titles"}`}
            aria-hidden
            style={{
              height: canvasLength(project.chapterProgress.height, 18),
              backgroundColor: colorWithOpacity(project.chapterProgress.backgroundColor, project.chapterProgress.backgroundOpacity),
              color: project.chapterProgress.textColor,
              "--chapter-bg": project.chapterProgress.backgroundColor,
              "--chapter-text": project.chapterProgress.textColor,
              "--chapter-accent": project.chapterProgress.activeColor,
              "--chapter-inactive": project.chapterProgress.inactiveColor,
              "--chapter-count": project.chapterProgress.chapters.length
            } as React.CSSProperties}
          >{project.chapterProgress.chapters.map((chapter, index) => <div key={chapter.id} className={`chapter-progress-item ${index === chapterState.activeIndex ? "active" : ""} ${index < chapterState.activeIndex ? "completed" : ""}`} style={{ "--chapter-fill": `${index === chapterState.activeIndex ? chapterState.localProgress * 100 : index < chapterState.activeIndex ? 100 : 0}%` } as React.CSSProperties}><span>{chapter.title}</span></div>)}</div>}
          {showTimelineGraphics && !shotcraftOwnsActiveSubtitle && subtitle && activeSubtitleStyle && <div className={`subtitle-overlay preset-${activeSubtitleStyle.stylePreset}`} style={{ bottom: `${100 - subtitle.positionY}%`, color: subtitle.color, backgroundColor: colorWithOpacity(subtitle.backgroundColor, activeSubtitleStyle.stylePreset === "minimal" ? 0 : activeSubtitleStyle.backgroundOpacity), borderRadius: canvasLength(activeSubtitleStyle.borderRadius), fontSize: canvasLength(subtitle.fontSize, 9), WebkitTextStroke: activeSubtitleStyle.outlineWidth > 0 ? `${canvasLength(activeSubtitleStyle.outlineWidth)} ${activeSubtitleStyle.outlineColor}` : undefined }}>{highlightedTextParts(displaySubtitleText(subtitle.text), activeSubtitleStyle.highlightWords).map((part, index) => <span key={`${index}-${part.text}`} className={part.highlighted ? "subtitle-highlight" : undefined} style={part.highlighted ? { color: activeSubtitleStyle.highlightColor } : undefined}>{part.text}</span>)}</div>}
          {effectPreview && previewClip && previewDefinition && previewRecipe && previewAppearance && <div className="effect-library-preview" key={`${effectPreview.compositionId}:${effectPreview.requestId}`}>
            {previewClip.recipe?.sceneBackground ? <div className="scene-background" style={{ ...sceneBackgroundStyle(previewClip.recipe.sceneBackground), zIndex: compositionLayer(previewClip) }} /> : mediaComposition(previewClip.compositionId) ? <div className="composition-overlay effect-preview-composition" style={{ left: `${previewClip.transform.x}%`, top: `${previewClip.transform.y}%`, zIndex: compositionLayer(previewClip), opacity: previewClip.transform.opacity, transform: `translate(-50%, -50%) scale(${previewClip.transform.scale}) rotate(${previewClip.transform.rotation}deg)` }}>
              <CompositionScene clip={previewClip} assets={previewModel?.assets ?? project.assets} width={project.canvas.width} height={project.canvas.height} localUs={effectPreviewTimeUs} selected={false} onSelect={() => undefined} />
            </div> : <div className={`effect-overlay react-effect ${usesFullCanvasComposition(previewClip.compositionId) ? "reference-full-canvas-effect" : ""} component-${previewClip.compositionId} motion-${project.motionTheme.skin} style-${project.motionTheme.style} recipe-${previewRecipe.layout} entrance-none`} style={{ left: `${previewClip.transform.x}%`, top: `${previewClip.transform.y}%`, zIndex: compositionLayer(previewClip), ...effectCardChromeStyle({ ...previewClip, ...previewAppearance }, previewRecipe, canvasLength, project.motionTheme, usesComponentChrome(previewClip.compositionId), usesFullCanvasComposition(previewClip.compositionId)), ...animatedStyle(previewRecipe, previewClip.transform, 0, previewClip.speed, {}, effectPreviewTimeUs), fontSize: canvasLength(previewClip.fontSize) } as React.CSSProperties}>
              <CompositionContent shotcraftData={isShotcraftComposition(previewClip.compositionId) ? { clip: previewClip } : undefined} shotcraftAssets={previewModel?.assets ?? project.assets} shotcraftTheme={project.motionTheme} compositionId={previewClip.compositionId} text={previewClip.text} color={previewAppearance.color} accentColor={previewAppearance.accentColor} fontSize={previewClip.fontSize} recipe={previewRecipe} params={effectMediaParams(previewClip, previewModel?.assets ?? project.assets)} timeUs={compositionTimeUs(previewClip, effectPreviewTimeUs)} durationUs={previewClip.animationDurationUs ?? previewClip.durationUs} canvasWidth={project.canvas.width} canvasHeight={project.canvas.height} />
            </div>}
            {renderFocusCardMedia(previewClip, previewModel?.assets ?? project.assets, effectPreviewTimeUs)}
          </div>}
          {presenterEditing && <PresenterSafeAreaOverlay key={project.id} settings={project.presenterSafeArea} onCommit={updatePresenterSafeArea} onHide={() => setShowPresenterSafeArea(false)} onClear={clearPresenterArea} />}
          {!hasContent && !effectPreview && !presenterEditing && <div className="empty-canvas"><strong>从任意内容开始</strong><p>导入视频或音频，也可以先准备文案生成字幕。</p><div><button className="button secondary" onClick={onImport}><FileVideo2 size={16} />导入媒体</button><button className="button primary" onClick={onGenerate}><Sparkles size={16} />生成字幕</button></div></div>}
        </div>
      </div>
      <CanvasSettingsDialog open={canvasSettingsOpen} onOpenChange={setCanvasSettingsOpen} canvas={project.canvas} assets={project.assets} />
      <ChapterProgressDialog open={chapterSettingsOpen} aiProvider={aiProvider} onOpenChange={setChapterSettingsOpen} onNeedSettings={onNeedSettings} />
    </section>
  );
}

function SyncedVideo({ src, sourceInUs, localUs, playbackRate, volume, muted, fit, camera, cameraStartOffsetUs, cameraDurationUs, focus, contentFocus = { x: 50, y: 50 }, transitionBlur = 0, playing, loopDurationUs, className = "video-content", onSelect }: { src: string; sourceInUs: number; localUs: number; playbackRate: number; volume: number; muted: boolean; fit: "cover" | "contain"; camera: CameraMotion; cameraStartOffsetUs: number; cameraDurationUs: number; focus?: VideoClip["focus"]; contentFocus?: VideoTargetPoint; transitionBlur?: number; playing: boolean; loopDurationUs?: number; className?: string; onSelect?: () => void }) {
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
  return <div className={className ?? "video-content"} onPointerDown={onSelect ? (event) => { event.stopPropagation(); onSelect(); } : undefined}><video ref={ref} src={src} muted={muted} playsInline preload="auto" loop={Boolean(loopDurationUs)} onLoadedMetadata={metadataReady} onCanPlay={canPlay} style={{ objectFit: fit, objectPosition: `${contentFocus.x}% ${contentFocus.y}%`, filter: transitionBlur > 0.01 ? `blur(${transitionBlur / 1920 * 100}cqw)` : undefined, transform: `translate(${cameraTranslateX}%, ${cameraTranslateY}%) scale(${combinedScale})` }} /></div>;
}

function AudioPreview({ clip, src, playheadUs, playing, ducked }: { clip: AudioClip; src: string; playheadUs: number; playing: boolean; ducked: boolean }) {
  return <AudioPreviewElement clip={clip} src={src} playheadUs={playheadUs} playing={playing} ducked={ducked} />;
}

function AudioPreviewElement({ clip, src, playheadUs, playing, ducked }: { clip: AudioClip; src: string; playheadUs: number; playing: boolean; ducked: boolean }) {
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
    audio.volume = previewNativeAudioVolume(clip.volume, fadeInGain, fadeOutGain, ducked);
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
