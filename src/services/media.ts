import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isDesktopRuntime } from "@/services/runtime";
import type { EffectRecipe } from "@/domain/effects";
import type { CameraMotion } from "@/domain/camera";

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
}

export interface RenderTextOverlay extends RenderOverlayBase {
  kind: "text";
  text: string;
  color: string;
  fontSize: number;
  accentColor: string;
  imageDataBase64?: string;
}

export interface RenderImageOverlay extends RenderOverlayBase {
  kind: "image";
  imagePath: string;
  targetWidthPx: number;
}

export type RenderOverlay = RenderTextOverlay | RenderImageOverlay;

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
  outputPath: string;
  encoder: "auto" | VideoEncoder;
  segments: RenderSegment[];
  overlays: RenderOverlay[];
  audios: RenderAudioClip[];
}

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

export async function selectVideoDestination(defaultName: string): Promise<string | null> {
  if (!isDesktopRuntime()) return null;
  return save({ defaultPath: `${defaultName}.mp4`, filters: [{ name: "MP4 视频", extensions: ["mp4"] }] });
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

async function rasterizeOverlay(overlay: RenderTextOverlay, canvasWidth: number): Promise<string> {
  const pixelScale = Math.min(2, window.devicePixelRatio || 1);
  const visualScale = Math.max(0.1, overlay.scale);
  const fontSize = Math.max(8, overlay.fontSize * visualScale);
  const paddingX = overlay.recipe.paddingX * visualScale;
  const paddingY = overlay.recipe.paddingY * visualScale;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d");
  if (!measure) throw new Error("当前环境不支持文字画布");
  measure.font = `800 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const maxTextWidth = canvasWidth * 0.72;
  const lines = wrapCanvasText(measure, overlay.text, maxTextWidth);
  const textWidth = Math.max(...lines.map((line) => measure.measureText(line).width), fontSize);
  const lineHeight = fontSize * 1.2;
  const baseWidth = Math.max(1, textWidth + paddingX * 2);
  const baseHeight = Math.max(1, lineHeight * lines.length + paddingY * 2);
  const radians = overlay.rotation * Math.PI / 180;
  const rotatedWidth = Math.abs(baseWidth * Math.cos(radians)) + Math.abs(baseHeight * Math.sin(radians));
  const rotatedHeight = Math.abs(baseWidth * Math.sin(radians)) + Math.abs(baseHeight * Math.cos(radians));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rotatedWidth * pixelScale);
  canvas.height = Math.ceil(rotatedHeight * pixelScale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境不支持文字画布");
  context.scale(pixelScale, pixelScale);
  context.translate(rotatedWidth / 2, rotatedHeight / 2);
  context.rotate(radians);
  context.translate(-baseWidth / 2, -baseHeight / 2);
  context.font = `800 ${fontSize}px Inter, "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.globalAlpha = overlay.opacity;
  context.lineJoin = "round";
  const background = `rgba(17, 19, 22, ${overlay.recipe.backgroundOpacity})`;
  if (overlay.recipe.backgroundOpacity > 0) {
    context.fillStyle = background;
    context.beginPath();
    context.roundRect(0, 0, baseWidth, baseHeight, overlay.recipe.borderRadius * visualScale);
    context.fill();
  }
  if (overlay.recipe.layout === "highlight") {
    context.fillStyle = overlay.accentColor;
    context.fillRect(paddingX * 0.35, baseHeight * 0.6, baseWidth - paddingX * 0.7, baseHeight * 0.25);
  } else if (overlay.recipe.layout === "panel") {
    context.fillStyle = overlay.accentColor;
    context.fillRect(0, 0, Math.max(2, overlay.recipe.borderWidth * visualScale), baseHeight);
  } else if (overlay.recipe.layout === "frame" && overlay.recipe.borderWidth > 0) {
    context.strokeStyle = overlay.accentColor;
    context.lineWidth = overlay.recipe.borderWidth * visualScale;
    context.beginPath();
    context.roundRect(context.lineWidth / 2, context.lineWidth / 2, baseWidth - context.lineWidth, baseHeight - context.lineWidth, overlay.recipe.borderRadius * visualScale);
    context.stroke();
  }
  context.lineWidth = Math.max(2, fontSize * 0.07);
  context.strokeStyle = "rgba(0, 0, 0, 0.68)";
  context.fillStyle = overlay.recipe.layout === "number" ? overlay.accentColor : overlay.color;
  lines.forEach((line, index) => {
    const x = baseWidth / 2;
    const y = paddingY + lineHeight * (index + 0.5);
    context.strokeText(line, x, y);
    context.fillText(line, x, y);
  });
  if (overlay.recipe.layout === "underline") {
    context.strokeStyle = overlay.accentColor;
    context.lineWidth = Math.max(2, fontSize * 0.08);
    context.beginPath();
    context.moveTo(paddingX * 0.5, baseHeight - paddingY * 0.35);
    context.lineTo(baseWidth - paddingX * 0.5, baseHeight - paddingY * 0.55);
    context.stroke();
  }
  return canvas.toDataURL("image/png").split(",", 2)[1];
}

export async function rasterizeRenderPlan(plan: RenderPlan): Promise<RenderPlan> {
  return {
    ...plan,
    overlays: await Promise.all(plan.overlays.map(async (overlay) => overlay.kind === "image" ? overlay : {
      ...overlay,
      imageDataBase64: await rasterizeOverlay(overlay, plan.width)
    }))
  };
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
