import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isDesktopRuntime } from "@/services/runtime";
import type { EffectRecipe } from "@/domain/effects";
import type { ChapterMarker, EffectBackdrop, SubtitleStylePreset, VideoFocusEffect, VideoMask, VideoTransition, VisualTransformKeyframe } from "@/domain/project";
import type { CameraMotion } from "@/domain/camera";
import { drawChartFrame, hexAlpha, measureChartBox } from "@/domain/chartEffects";
import { highlightedTextParts } from "@/domain/videoDecorations";

export interface MediaToolStatus {
  ffmpegPath?: string;
  ffprobePath?: string;
  ready: boolean;
  message: string;
  availableEncoders: VideoEncoder[];
  recommendedEncoder: VideoEncoder;
  bundled: boolean;
}

export type VideoEncoder = "software" | "videotoolbox" | "nvenc" | "qsv";

export interface ExportJobEvent {
  jobId: string;
  phase: "preparing" | "rendering" | "overlays" | "audio" | "complete";
  message: string;
  progress: number;
  segmentIndex: number;
  segmentCount: number;
}

export interface MediaProbe {
  durationUs: number;
  width: number;
  height: number;
  fpsNumerator: number;
  fpsDenominator: number;
  videoCodec: string;
  audioCodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  fileSize: number;
}

export interface MediaDerivatives {
  thumbnailPath?: string;
  waveformPath?: string;
}

export interface ProxyJobEvent {
  jobId: string;
  message: string;
  progress: number;
}

export interface ProxyMediaResult {
  proxyPath: string;
  height: number;
}

export interface AudioExtractionResult {
  path: string;
}

export interface RenderSegment {
  kind: "video" | "generated" | "gap";
  durationUs: number;
  path?: string;
  sourceInUs?: number;
  playbackRate?: number;
  volume?: number;
  fit?: "cover" | "contain";
  hasAudio?: boolean;
  loop?: boolean;
  camera?: CameraMotion;
  cameraOffsetUs?: number;
  cameraDurationUs?: number;
  color?: string;
  title?: string;
}

interface RenderOverlayBase {
  startUs: number;
  durationUs: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  rotation: number;
  speed: number;
  recipe: EffectRecipe;
  zIndex: number;
  transformKeyframes?: VisualTransformKeyframe[];
}

export interface RenderTextOverlay extends RenderOverlayBase {
  kind: "text";
  text: string;
  color: string;
  fontSize: number;
  accentColor: string;
  /** Static baked appearance; absent when the overlay ships a frame sequence instead. */
  imageDataBase64?: string;
  /**
   * Per-frame RGBA PNGs (in chronological order) for procedural overlays —
   * charts and the underline sweep. Export replays them verbatim so the
   * preview's f(playhead) stays identical on the timeline.
   */
  sequenceFramesBase64?: string[];
  backdrop?: EffectBackdrop;
  subtitleStyle?: {
    preset: SubtitleStylePreset;
    highlightWords: string[];
    highlightColor: string;
    outlineColor: string;
    outlineWidth: number;
    backgroundOpacity: number;
    borderRadius: number;
  };
}

export interface RenderImageOverlay extends RenderOverlayBase {
  kind: "image";
  imagePath: string;
  targetWidthPx: number;
}

export interface RenderVideoOverlay extends RenderOverlayBase {
  kind: "video";
  path: string;
  sourceInUs: number;
  playbackRate: number;
  fit: "cover" | "contain";
  loop: boolean;
  camera: CameraMotion;
  cameraOffsetUs: number;
  cameraDurationUs: number;
  mask?: VideoMask;
  transition?: VideoTransition;
  focus?: VideoFocusEffect;
}

export interface RenderFocusOverlay extends RenderOverlayBase {
  kind: "focus";
  focus: VideoFocusEffect;
  mask?: VideoMask;
  imageDataBase64?: string;
}

export interface RenderSceneOverlay extends RenderOverlayBase {
  kind: "scene";
  imageDataBase64?: string;
}

export interface RenderProgressOverlay extends RenderOverlayBase {
  kind: "progress";
  chapters: ChapterMarker[];
  chapterIndex: number;
  backgroundColor: string;
  activeColor: string;
  textColor: string;
  heightPx: number;
  imageDataBase64?: string;
}

export type RenderOverlay = RenderTextOverlay | RenderImageOverlay | RenderVideoOverlay | RenderFocusOverlay | RenderSceneOverlay | RenderProgressOverlay;

export interface RenderAudioClip {
  path: string;
  startUs: number;
  durationUs: number;
  sourceInUs: number;
  playbackRate: number;
  volume: number;
  fadeInUs: number;
  fadeOutUs: number;
  role: "voice" | "music" | "sound";
}

export interface RenderPlan {
  width: number;
  height: number;
  fps: number;
  format: ExportVideoFormat;
  outputPath: string;
  encoder: "auto" | VideoEncoder;
  segments: RenderSegment[];
  overlays: RenderOverlay[];
  audios: RenderAudioClip[];
}

export type ExportVideoFormat = "mp4" | "mov";

export async function selectMediaPaths(): Promise<string[]> {
  if (!isDesktopRuntime()) return [];
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "媒体", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "png", "jpg", "jpeg", "webp", "bmp"] }]
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function selectReplacementMediaPath(defaultPath?: string): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    defaultPath,
    filters: [{ name: "媒体", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mp3", "wav", "m4a", "aac", "flac", "png", "jpg", "jpeg", "webp"] }]
  });
  return typeof selected === "string" ? selected : null;
}

export async function selectProjectToOpen(): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  const selected = await open({ multiple: false, directory: false, filters: [{ name: "BVideo 工程", extensions: ["bvideo.json", "json"] }] });
  return typeof selected === "string" ? selected : null;
}

export async function selectProjectDestination(defaultName: string): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({ defaultPath: `${defaultName}.bvideo.json`, filters: [{ name: "BVideo 工程", extensions: ["bvideo.json"] }] });
}

export async function selectVideoDestination(defaultName: string, format: ExportVideoFormat): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({
    defaultPath: `${defaultName}.${format}`,
    filters: [{ name: format === "mov" ? "QuickTime 视频" : "MP4 视频", extensions: [format] }]
  });
}

export async function selectAudioDestination(defaultName: string): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({
    defaultPath: `${defaultName}.m4a`,
    filters: [
      { name: "M4A 音频", extensions: ["m4a"] },
      { name: "WAV 音频", extensions: ["wav"] },
      { name: "MP3 音频", extensions: ["mp3"] },
      { name: "FLAC 音频", extensions: ["flac"] }
    ]
  });
}

export function localMediaUrl(path: string): string {
  return convertFileSrc(path);
}

export function getMediaToolStatus(): Promise<MediaToolStatus> {
  return invoke("media_tool_status");
}

export function probeMedia(path: string): Promise<MediaProbe> {
  return invoke("probe_media", { path });
}

export function generateMediaDerivatives(path: string, assetId: string, hasVideo: boolean, hasAudio: boolean): Promise<MediaDerivatives> {
  return invoke("generate_media_derivatives", { path, assetId, hasVideo, hasAudio });
}

export function startProxyGeneration(path: string, assetId: string, height: 540 | 720, durationUs: number, onProgress: (event: ProxyJobEvent) => void) {
  const jobId = crypto.randomUUID();
  const onEvent = new Channel<ProxyJobEvent>();
  onEvent.onmessage = onProgress;
  return { jobId, result: invoke<ProxyMediaResult>("generate_proxy_media", { path, assetId, height, durationUs, jobId, onEvent }) };
}

export function startAudioExtraction(path: string, assetId: string, durationUs: number, outputPath: string | null, onProgress: (event: ProxyJobEvent) => void) {
  const jobId = crypto.randomUUID();
  const onEvent = new Channel<ProxyJobEvent>();
  onEvent.onmessage = onProgress;
  return { jobId, result: invoke<AudioExtractionResult>("extract_media_audio", { path, assetId, durationUs, outputPath, jobId, onEvent }) };
}

export function startExportRenderPlan(plan: RenderPlan, onProgress: (event: ExportJobEvent) => void) {
  const jobId = crypto.randomUUID();
  const onEvent = new Channel<ExportJobEvent>();
  onEvent.onmessage = onProgress;
  return { jobId, result: invoke<string>("export_render_plan", { plan, jobId, onEvent }) };
}

export function cancelExportJob(jobId: string): Promise<boolean> {
  return invoke("cancel_export_job", { jobId });
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of Array.from(paragraph || " ")) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

const FONT_STACK = `800 {size}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;

interface OverlayGeometry {
  measure: CanvasRenderingContext2D;
  lines: string[];
  fontSize: number;
  visualScale: number;
  paddingX: number;
  paddingY: number;
  baseWidth: number;
  baseHeight: number;
  radians: number;
  rotatedWidth: number;
  rotatedHeight: number;
  contentWidth: number;
  contentHeight: number;
}

function measureOverlay(overlay: RenderTextOverlay, canvasWidth: number): OverlayGeometry {
  const visualScale = Math.max(0.1, overlay.scale);
  let fontSize = Math.max(8, overlay.fontSize * visualScale);
  const paddingX = (overlay.backdrop?.enabled ? overlay.backdrop.paddingX : overlay.recipe.paddingX) * visualScale;
  const paddingY = (overlay.backdrop?.enabled ? overlay.backdrop.paddingY : overlay.recipe.paddingY) * visualScale;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("当前环境不支持文字画布");
  measure.font = FONT_STACK.replace("{size}", String(fontSize));
  let text = overlay.text.trim();
  let minBox: { width: number; height: number } | null = null;
  if (overlay.recipe.chart) {
    minBox = measureChartBox(overlay.recipe.chart, fontSize);
    if (!text) {
      // Chart-only overlays still need a text box large enough for the plot area.
      fontSize = Math.max(fontSize, Math.min(minBox.width, minBox.height) / 3);
      measure.font = FONT_STACK.replace("{size}", String(fontSize));
    }
  }
  const maxTextWidth = canvasWidth * 0.72 - paddingX * 2;
  const lines = text ? wrapCanvasText(measure, text, Math.max(40, minBox ? minBox.width - paddingX * 2 : maxTextWidth)) : [];
  const textWidth = lines.length ? Math.max(...lines.map((line) => measure.measureText(line).width), fontSize) : (minBox?.width ?? fontSize);
  const lineHeight = fontSize * 1.2;
  const chartNeed = minBox
    ? {
        width: (minBox.width + paddingX * 2) * 1,
        height: minBox.height + paddingY * 2
      }
    : null;
  const baseWidth = Math.max(chartNeed?.width ?? 1, textWidth + paddingX * 2);
  const baseHeight = Math.max(chartNeed?.height ?? 1, (text ? lineHeight * lines.length : lineHeight) + paddingY * 2);
  const radians = overlay.rotation * Math.PI / 180;
  const rotatedWidth = Math.abs(baseWidth * Math.cos(radians)) + Math.abs(baseHeight * Math.sin(radians));
  const rotatedHeight = Math.abs(baseWidth * Math.sin(radians)) + Math.abs(baseHeight * Math.cos(radians));
  return {
    measure,
    lines,
    fontSize,
    visualScale,
    paddingX,
    paddingY,
    baseWidth: Math.max(1, baseWidth),
    baseHeight: Math.max(1, baseHeight),
    radians,
    rotatedWidth: Math.max(1, rotatedWidth),
    rotatedHeight: Math.max(1, rotatedHeight),
    contentWidth: Math.max(1, baseWidth - paddingX * 2),
    contentHeight: Math.max(1, baseHeight - paddingY * 2)
  };
}

function createOverlayCanvas(geometry: OverlayGeometry): CanvasRenderingContext2D | null {
  const pixelScale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(geometry.rotatedWidth * pixelScale);
  canvas.height = Math.ceil(geometry.rotatedHeight * pixelScale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(pixelScale, pixelScale);
  context.translate(geometry.rotatedWidth / 2, geometry.rotatedHeight / 2);
  context.rotate(geometry.radians);
  context.translate(-geometry.baseWidth / 2, -geometry.baseHeight / 2);
  context.lineJoin = "round";
  return context;
}

/** Shared card chrome: background plate, highlight sweep zone, panel bar, frame stroke. */
function paintChrome(context: CanvasRenderingContext2D, overlay: RenderTextOverlay, geometry: OverlayGeometry) {
  const { recipe } = overlay;
  const { baseWidth, baseHeight, paddingX, visualScale } = geometry;
  const backgroundOpacity = overlay.backdrop?.enabled ? overlay.backdrop.opacity : recipe.backgroundOpacity;
  if (backgroundOpacity > 0) {
    context.fillStyle = overlay.backdrop?.enabled
      ? hexAlpha(overlay.backdrop.color, backgroundOpacity)
      : overlay.subtitleStyle
        ? hexAlpha(overlay.accentColor, overlay.subtitleStyle.backgroundOpacity)
        : `rgba(17, 19, 22, ${backgroundOpacity})`;
    context.beginPath();
    context.roundRect(0, 0, baseWidth, baseHeight, (overlay.backdrop?.enabled ? overlay.backdrop.radius : recipe.borderRadius) * visualScale);
    context.fill();
  }
  if (recipe.layout === "highlight") {
    context.fillStyle = overlay.accentColor;
    context.fillRect(paddingX * 0.35, baseHeight * 0.6, baseWidth - paddingX * 0.7, baseHeight * 0.25);
  } else if (recipe.layout === "panel") {
    context.fillStyle = overlay.accentColor;
    context.fillRect(0, 0, Math.max(2, recipe.borderWidth * visualScale), baseHeight);
  } else if (recipe.layout === "frame" && recipe.borderWidth > 0) {
    context.strokeStyle = overlay.accentColor;
    context.lineWidth = recipe.borderWidth * visualScale;
    context.beginPath();
    context.roundRect(context.lineWidth / 2, context.lineWidth / 2, baseWidth - context.lineWidth, baseHeight - context.lineWidth, recipe.borderRadius * visualScale);
    context.stroke();
  }
}

function paintCaptionAndText(context: CanvasRenderingContext2D, overlay: RenderTextOverlay, geometry: OverlayGeometry) {
  const { lines, fontSize, paddingY, baseWidth } = geometry;
  if (!lines.length) return;
  const lineHeight = fontSize * 1.2;
  const startY = paddingY + lineHeight * 0.5;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.globalAlpha = overlay.opacity;
  const style = overlay.subtitleStyle;
  const fontWeight = style?.preset === "bold" ? 900 : style?.preset === "minimal" ? 700 : 800;
  context.lineWidth = style ? style.outlineWidth : Math.max(2, fontSize * 0.07);
  context.strokeStyle = style?.outlineColor ?? "rgba(0, 0, 0, 0.68)";
  context.font = `${fontWeight} ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
  lines.forEach((line, index) => {
    const y = startY + lineHeight * index;
    const parts = style ? highlightedTextParts(line, style.highlightWords) : [{ text: line, highlighted: false }];
    const lineWidth = parts.reduce((width, part) => width + context.measureText(part.text).width, 0);
    let x = baseWidth / 2 - lineWidth / 2;
    context.textAlign = "left";
    for (const part of parts) {
      if (context.lineWidth > 0) context.strokeText(part.text, x, y);
      context.fillStyle = part.highlighted ? style?.highlightColor ?? overlay.color : overlay.recipe.layout === "number" && !overlay.recipe.chart ? overlay.accentColor : overlay.color;
      context.fillText(part.text, x, y);
      x += context.measureText(part.text).width;
    }
  });
}

function captionFor(overlay: RenderTextOverlay) {
  return overlay.recipe.chart && overlay.text.trim() ? overlay.text.trim() : undefined;
}

function paintChart(context: CanvasRenderingContext2D, overlay: RenderTextOverlay, geometry: OverlayGeometry, progress: number) {
  if (!overlay.recipe.chart) return;
  context.save();
  context.translate(geometry.paddingX, geometry.paddingY);
  drawChartFrame(
    context,
    { width: geometry.contentWidth, height: geometry.contentHeight },
    overlay.recipe.chart,
    { textColor: overlay.color, accentColor: overlay.accentColor },
    { caption: captionFor(overlay), fontSize: geometry.fontSize },
    progress
  );
  context.restore();
}

/** One deterministic animation frame of a procedural overlay (chart or underline sweep). */
function paintSequenceFrame(overlay: RenderTextOverlay, geometry: OverlayGeometry, progress: number): string | null {
  const context = createOverlayCanvas(geometry);
  if (!context) return null;
  paintChrome(context, overlay, geometry);
  const clamped = Math.max(0, Math.min(1, progress));
  if (overlay.recipe.chart) {
    paintChart(context, overlay, geometry, clamped);
  } else {
    paintCaptionAndText(context, overlay, geometry);
    // Underline layout: sweep the accent line left→right like the preview pseudo-element.
    const startX = geometry.paddingX * 0.5;
    const endX = geometry.baseWidth - geometry.paddingX * 0.5;
    const currentEnd = startX + (endX - startX) * easedCubicOut(clamped);
    context.strokeStyle = overlay.accentColor;
    context.lineWidth = Math.max(2, geometry.fontSize * 0.08);
    context.beginPath();
    context.moveTo(startX, geometry.baseHeight - geometry.paddingY * 0.35);
    context.lineTo(currentEnd, geometry.baseHeight - geometry.paddingY * 0.35);
    context.stroke();
  }
  return context.canvas.toDataURL("image/png").split(",", 2)[1];
}

const SEQUENCE_MAX_FRAMES = 720;

/** How long the reveal phase of an overlay lasts, mirroring preview timing rules. */
function sequenceRevealSeconds(overlay: RenderTextOverlay) {
  const speed = Math.max(0.1, overlay.speed);
  if (overlay.recipe.chart) return (overlay.recipe.chart.durationSeconds ?? 1.2) / speed;
  return 0.45 / speed;
}

/**
 * Renders per-frame PNGs for procedural overlays (charts and the underline sweep).
 * Returns null when the clip is too long to encode affordably; the caller then falls
 * back to a static baked frame with the final state.
 */
function rasterizeSequence(overlay: RenderTextOverlay, canvasWidth: number, planFps: number): string[] | null {
  const totalSeconds = overlay.durationUs / 1_000_000;
  let fps = Math.max(1, Math.min(planFps || 30, 24));
  let frames = Math.ceil(totalSeconds * fps) + 1;
  if (frames > SEQUENCE_MAX_FRAMES) {
    fps = Math.max(6, Math.floor(SEQUENCE_MAX_FRAMES / totalSeconds));
    frames = Math.min(SEQUENCE_MAX_FRAMES, Math.ceil(totalSeconds * fps) + 1);
    if (frames > SEQUENCE_MAX_FRAMES) return null;
  }
  const geometry = measureOverlay(overlay, canvasWidth);
  const sequence: string[] = [];
  const revealSeconds = sequenceRevealSeconds(overlay);
  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    const progress = Math.max(0, Math.min(1, frameIndex / fps / Math.max(0.05, revealSeconds)));
    const frame = paintSequenceFrame(overlay, geometry, progress);
    if (!frame) return null;
    sequence.push(frame);
  }
  // Always end on the completed state so long clips freeze correctly at the tail.
  const finalFrame = paintSequenceFrame(overlay, geometry, 1);
  if (finalFrame) sequence[sequence.length - 1] = finalFrame;
  return sequence;
}

function needsSequence(overlay: RenderTextOverlay) {
  return Boolean(overlay.recipe.chart) || overlay.recipe.layout === "underline";
}

function easedCubicOut(progress: number) {
  return 1 - (1 - progress) ** 3;
}

/** Static bake for classic declarative overlays (and the too-long fallback, which freezes the final frame). */
async function rasterizeStaticOverlay(overlay: RenderTextOverlay, canvasWidth: number): Promise<string> {
  const geometry = measureOverlay(overlay, canvasWidth);
  const context = createOverlayCanvas(geometry);
  if (!context) throw new Error("当前环境不支持文字画布");
  paintChrome(context, overlay, geometry);
  if (overlay.recipe.chart) {
    paintChart(context, overlay, geometry, 1);
  } else {
    paintCaptionAndText(context, overlay, geometry);
  }
  return context.canvas.toDataURL("image/png").split(",", 2)[1];
}

function rasterizeFocusOverlay(overlay: RenderFocusOverlay, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持聚光画布");
  const focusX = width * overlay.focus.x / 100;
  const focusY = height * overlay.focus.y / 100;
  const radius = Math.min(width, height) * overlay.focus.radius / 100;
  const feather = Math.max(1, Math.min(width, height) * overlay.focus.feather / 100);
  context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(0.9, overlay.focus.dimOpacity))})`;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "destination-out";
  const gradient = context.createRadialGradient(focusX, focusY, Math.max(0, radius - feather), focusX, focusY, radius + feather);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  if (overlay.focus.showCursor) {
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = "rgba(255, 184, 77, 0.95)";
    context.lineWidth = Math.max(3, Math.min(width, height) * 0.004);
    context.beginPath();
    context.arc(focusX, focusY, Math.max(12, radius * 0.18), 0, Math.PI * 2);
    context.stroke();
  }
  return canvas.toDataURL("image/png").split(",", 2)[1];
}

function rasterizeSceneOverlay(overlay: RenderSceneOverlay, width: number, height: number): string {
  const scene = overlay.recipe.sceneBackground;
  if (!scene) throw new Error("场景背景缺少样式配置");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持场景画布");
  context.fillStyle = scene.primaryColor;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = Math.max(0.1, Math.min(1, scene.intensity));
  context.strokeStyle = scene.secondaryColor;
  context.fillStyle = scene.secondaryColor;
  context.lineWidth = Math.max(1, width / 960);
  const grid = Math.max(24, Math.round(width / 20));
  if (scene.preset === "black-stripes") {
    for (let x = -height; x < width + height; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + height, height); context.stroke(); }
  } else if (scene.preset === "dark-grid" || scene.preset === "blueprint") {
    for (let x = 0; x <= width; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 0; y <= height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  } else if (scene.preset === "paper-lines") {
    for (let y = grid; y < height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  } else if (scene.preset === "spotlight") {
    const gradient = context.createRadialGradient(width * 0.5, height * 0.44, 0, width * 0.5, height * 0.44, Math.max(width, height) * 0.58);
    gradient.addColorStop(0, scene.secondaryColor);
    gradient.addColorStop(1, scene.primaryColor);
    context.globalAlpha = 1;
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  } else if (scene.preset === "contrast-side") {
    context.fillRect(0, 0, width * 0.24, height);
  }
  context.globalAlpha = 1;
  context.strokeStyle = scene.borderColor;
  if (scene.preset === "white-frame") context.strokeRect(width * 0.025, height * 0.045, width * 0.95, height * 0.91);
  if (scene.preset === "clean-white") context.fillStyle = scene.borderColor, context.fillRect(0, 0, width, Math.max(4, height * 0.012));
  if (scene.preset === "paper-lines") context.fillStyle = scene.borderColor, context.fillRect(width * 0.075, 0, Math.max(2, width * 0.003), height);
  if (scene.preset === "contrast-side") context.fillStyle = scene.borderColor, context.fillRect(width * 0.24, 0, Math.max(3, width * 0.004), height);
  return canvas.toDataURL("image/png").split(",", 2)[1];
}

function ellipsizeCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function rasterizeProgressOverlay(overlay: RenderProgressOverlay, width: number): string {
  const height = Math.max(28, Math.round(overlay.heightPx));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持章节进度画布");
  context.fillStyle = hexAlpha(overlay.backgroundColor, 0.9);
  context.fillRect(0, 0, width, height);
  const count = Math.max(1, overlay.chapters.length);
  const itemWidth = width / count;
  const fontSize = Math.max(10, Math.min(18, height * 0.3));
  context.font = `700 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  overlay.chapters.forEach((chapter, index) => {
    const active = index === overlay.chapterIndex;
    const completed = index < overlay.chapterIndex;
    context.globalAlpha = active ? 1 : completed ? 0.72 : 0.46;
    context.fillStyle = overlay.textColor;
    const label = ellipsizeCanvasText(context, chapter.title, Math.max(16, itemWidth - 22));
    context.fillText(label, itemWidth * (index + 0.5), height * 0.47);
    if (index > 0) {
      context.globalAlpha = 0.18;
      context.fillRect(itemWidth * index, height * 0.25, 1, height * 0.5);
    }
    if (active) {
      context.globalAlpha = 1;
      context.fillStyle = overlay.activeColor;
      context.fillRect(itemWidth * index, height - Math.max(3, height * 0.08), itemWidth, Math.max(3, height * 0.08));
    }
  });
  context.globalAlpha = 1;
  return canvas.toDataURL("image/png").split(",", 2)[1];
}

export async function rasterizeRenderPlan(plan: RenderPlan): Promise<RenderPlan> {
  const rasterized = await Promise.all(plan.overlays.map(async (overlay) => {
    if (overlay.kind === "focus") return { ...overlay, imageDataBase64: rasterizeFocusOverlay(overlay, plan.width, plan.height) };
    if (overlay.kind === "scene") return { ...overlay, imageDataBase64: rasterizeSceneOverlay(overlay, plan.width, plan.height) };
    if (overlay.kind === "progress") return { ...overlay, imageDataBase64: rasterizeProgressOverlay(overlay, plan.width) };
    if (overlay.kind !== "text") return overlay;
    if (needsSequence(overlay)) {
      const sequence = rasterizeSequence(overlay, plan.width, plan.fps);
      if (sequence) return { ...overlay, sequenceFramesBase64: sequence };
      // Too long to afford frames — bake the finished state instead.
      return { ...overlay, imageDataBase64: await rasterizeStaticOverlay(overlay, plan.width) };
    }
    return { ...overlay, imageDataBase64: await rasterizeStaticOverlay(overlay, plan.width) };
  }));
  return { ...plan, overlays: rasterized };
}

export function saveProjectFile(path: string, contents: string): Promise<void> {
  return invoke("save_project_file", { path, contents });
}

export function readProjectFile(path: string): Promise<string> {
  return invoke("read_project_file", { path });
}

export function mediaPathExists(path: string): Promise<boolean> {
  return invoke("media_path_exists", { path });
}
