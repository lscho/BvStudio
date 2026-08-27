import type { EffectEntrance, EffectRecipe } from "@/domain/effects";
import type { CameraMotion } from "@/domain/camera";

export type TrackKind = "video" | "image" | "generated" | "effect" | "subtitle" | "audio";
export type InsertMode = "insert" | "replace" | "overlay";

export interface TransformProps {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface VisualTransformKeyframe {
  offsetUs: number;
  x: number;
  y: number;
  scale: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}

export interface MediaAsset {
  id: string;
  name: string;
  kind: "video" | "image" | "audio";
  durationUs: number;
  objectUrl?: string;
  sourcePath?: string;
  width?: number;
  height?: number;
  fpsNumerator?: number;
  fpsDenominator?: number;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio?: boolean;
  fileSize?: number;
  thumbnailPath?: string;
  waveformPath?: string;
  proxyPath?: string;
  proxyObjectUrl?: string;
  proxyHeight?: number;
  missing?: boolean;
}

export interface BaseClip {
  id: string;
  trackId: string;
  kind: TrackKind;
  label: string;
  startUs: number;
  durationUs: number;
  locked: boolean;
}

export interface VideoClip extends BaseClip {
  kind: "video";
  assetId: string;
  sourceInUs: number;
  playbackRate: number;
  volume: number;
  fit: "cover" | "contain";
  camera: CameraMotion;
  zIndex?: number;
  transform?: TransformProps;
  transformKeyframes?: VisualTransformKeyframe[];
  layoutPreset?: "full" | "picture-in-picture-top-left" | "picture-in-picture-top-right" | "picture-in-picture-bottom-left" | "picture-in-picture-bottom-right" | "shrink-top-left" | "shrink-top-right" | "shrink-bottom-left" | "shrink-bottom-right" | "reveal-center" | "custom";
}

export interface ImageClip extends BaseClip {
  kind: "image";
  assetId: string;
  transform: TransformProps;
  entrance: EffectEntrance;
  speed: number;
}

export type AudioRole = "voice" | "music" | "sound";

export interface AudioClip extends BaseClip {
  kind: "audio";
  assetId: string;
  sourceInUs: number;
  playbackRate: number;
  volume: number;
  fadeInUs: number;
  fadeOutUs: number;
  role: AudioRole;
}

export interface EffectClip extends BaseClip {
  kind: "effect";
  effectId: string;
  text: string;
  color: string;
  accentColor: string;
  fontSize: number;
  speed: number;
  transform: TransformProps;
  recipe?: EffectRecipe;
  zIndex?: number;
  sceneGroupId?: string;
  sceneTemplateId?: string;
  matchQuery?: string;
  transformKeyframes?: VisualTransformKeyframe[];
}

export interface GeneratedEffectLayer {
  id: string;
  effectId: string;
  text: string;
  textColor: string;
  accentColor: string;
  fontSize: number;
  speed: number;
  transform: TransformProps;
  startOffsetUs: number;
  durationUs: number;
  zIndex: number;
  source: "ai" | "manual" | "scene-template" | "subtitle-match";
  matchQuery?: string;
  recipe?: EffectRecipe;
  transformKeyframes?: VisualTransformKeyframe[];
}

export interface GeneratedScene {
  id: string;
  title: string;
  narration: string;
  durationUs: number;
  effectId: string;
  textColor: string;
  accentColor: string;
  fontSize: number;
  speed: number;
  transform: TransformProps;
  mediaAssetId?: string;
  mediaSourceInUs: number;
  mediaFit: "cover" | "contain";
  mediaVolume: number;
  camera: CameraMotion;
  recipe?: EffectRecipe;
  additionalEffects?: GeneratedEffectLayer[];
  secondaryMediaAssetId?: string;
  secondaryMediaSourceInUs?: number;
  secondaryMediaFit?: "cover" | "contain";
  secondaryMediaVolume?: number;
  mediaLayoutPreset?: VideoClip["layoutPreset"];
}

export interface GeneratedBlock extends BaseClip {
  kind: "generated";
  article: string;
  narration: string;
  prompt: string;
  insertMode: InsertMode;
  scenes: GeneratedScene[];
}

export interface SubtitleClip extends BaseClip {
  kind: "subtitle";
  text: string;
  sourceAssetId?: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  positionY: number;
}

export type TimelineClip = VideoClip | ImageClip | AudioClip | EffectClip | GeneratedBlock | SubtitleClip;

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  name: string;
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  audioRole?: AudioRole;
  clips: TimelineClip[];
}

export interface EditorProject {
  schemaVersion: 11;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; fpsNumerator: number; fpsDenominator: number };
  durationUs: number;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
}

export function createEmptyProject(): EditorProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 11,
    id: crypto.randomUUID(),
    name: "未命名项目",
    createdAt: now,
    updatedAt: now,
    canvas: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 },
    durationUs: 30_000_000,
    assets: [],
    tracks: [
      { id: "video-main", kind: "video", name: "主视频", locked: false, muted: false, hidden: false, clips: [] },
      { id: "video-overlay", kind: "video", name: "叠加视频", locked: false, muted: false, hidden: false, clips: [] },
      { id: "image-main", kind: "image", name: "贴图", locked: false, muted: false, hidden: false, clips: [] },
      { id: "generated-main", kind: "generated", name: "AI 内容", locked: false, muted: false, hidden: false, clips: [] },
      { id: "effect-main", kind: "effect", name: "动效", locked: false, muted: false, hidden: false, clips: [] },
      { id: "subtitle-main", kind: "subtitle", name: "字幕", locked: false, muted: false, hidden: false, clips: [] },
      { id: "audio-voice", kind: "audio", name: "配音", audioRole: "voice", locked: false, muted: false, hidden: false, clips: [] },
      { id: "audio-music", kind: "audio", name: "背景音乐", audioRole: "music", locked: false, muted: false, hidden: false, clips: [] },
      { id: "audio-sound", kind: "audio", name: "音效", audioRole: "sound", locked: false, muted: false, hidden: false, clips: [] }
    ]
  };
}

export function projectEndUs(project: EditorProject): number {
  return Math.max(30_000_000, contentEndUs(project));
}

export function contentEndUs(project: EditorProject): number {
  return project.tracks.flatMap((track) => track.clips).reduce(
    (maximum, clip) => Math.max(maximum, clip.startUs + clip.durationUs),
    0
  );
}
