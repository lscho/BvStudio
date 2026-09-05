import type { EffectEntrance, EffectParams, EffectRecipe, EffectSoundCue, SceneBackgroundSpec } from "@/domain/effects";
import type { CameraMotion } from "@/domain/camera";
import type { EasingName } from "@/domain/easing";

export type TrackKind = "video" | "image" | "generated" | "scene" | "effect" | "subtitle" | "audio";
export type InsertMode = "insert" | "replace" | "overlay";
export type VideoRole = "a-roll" | "b-roll" | "presenter" | "screen" | "supporting" | "unspecified";
export type VideoShape = "rectangle" | "rounded" | "circle" | "ellipse" | "square" | "portrait";
export type VideoTransitionPreset = "none" | "fade" | "slide-left" | "slide-right" | "zoom" | "dock" | "circle-reveal";
export type VideoMotionPresetId = "full-screen" | "zoom-to-full" | "presenter-circle-bottom-right" | "picture-in-picture-top-right" | "split-left" | "split-right" | "slow-push-in" | "screen-magnify" | "screen-spotlight" | "screen-focus";

export interface VideoMask {
  shape: VideoShape;
  radius: number;
  feather: number;
  borderWidth: number;
  borderColor: string;
  focusX: number;
  focusY: number;
}

export interface VideoTransition {
  preset: VideoTransitionPreset;
  durationUs: number;
  easing: EasingName;
}

export interface VideoFocusEffect {
  enabled: boolean;
  startOffsetUs: number;
  durationUs: number;
  x: number;
  y: number;
  zoom: number;
  radius: number;
  feather: number;
  dimOpacity: number;
  showCursor: boolean;
}

export interface VideoPresentationCue {
  id: string;
  offsetUs: number;
  transitionDurationUs: number;
  presetId: VideoMotionPresetId;
  transform: TransformProps;
  mask: VideoMask;
  focus: VideoFocusEffect;
  camera: CameraMotion;
  fit: "cover" | "contain";
}

export interface EffectBackdrop {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  paddingX: number;
  paddingY: number;
  radius: number;
}

export type MotionSkin = "dark" | "light";
export type MotionStyle = "minimal" | "editorial";
export type MotionFont = "sans" | "display";
export type MotionColorRole = "data" | "opinion" | "warning" | "auxiliary" | "custom";
export type PresenterSafeAreaPosition = "none" | "left" | "center" | "right";

export interface PresenterSafeAreaSettings {
  position: PresenterSafeAreaPosition;
  widthPercent: number;
}

export const DEFAULT_PRESENTER_SAFE_AREA: PresenterSafeAreaSettings = {
  position: "center",
  widthPercent: 32
};

export interface MotionTheme {
  skin: MotionSkin;
  style: MotionStyle;
  font: MotionFont;
  colors: {
    text: string;
    surface: string;
    data: string;
    opinion: string;
    warning: string;
    auxiliary: string;
  };
}

export const DEFAULT_MOTION_THEME: MotionTheme = {
  skin: "dark",
  style: "minimal",
  font: "sans",
  colors: {
    text: "#ffffff",
    surface: "#111316",
    data: "#5fa8ff",
    opinion: "#5fa8ff",
    warning: "#5fa8ff",
    auxiliary: "#5fa8ff"
  }
};

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
  easing: EasingName;
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
  sourceBlockId?: string;
  sourceSubtitleId?: string;
}

export interface VideoClip extends BaseClip {
  kind: "video";
  assetId: string;
  sourceInUs: number;
  playbackRate: number;
  volume: number;
  fit: "cover" | "contain";
  camera: CameraMotion;
  cameraOffsetUs?: number;
  cameraDurationUs?: number;
  zIndex?: number;
  transform?: TransformProps;
  transformKeyframes?: VisualTransformKeyframe[];
  layoutPreset?: "full" | "picture-in-picture-top-left" | "picture-in-picture-top-right" | "picture-in-picture-bottom-left" | "picture-in-picture-bottom-right" | "shrink-top-left" | "shrink-top-right" | "shrink-bottom-left" | "shrink-bottom-right" | "reveal-center" | "split-left" | "split-right" | "presenter-bottom-right" | "custom";
  role?: VideoRole;
  mask?: VideoMask;
  transition?: VideoTransition;
  focus?: VideoFocusEffect;
  presentationCues?: VideoPresentationCue[];
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
  params?: EffectParams;
  soundCues?: EffectSoundCue[];
  zIndex?: number;
  sceneGroupId?: string;
  sceneTemplateId?: string;
  matchQuery?: string;
  transformKeyframes?: VisualTransformKeyframe[];
  backdrop?: EffectBackdrop;
  colorRole?: MotionColorRole;
  dimAtUs?: number;
  lintOff?: string[];
}

export interface SceneClip extends BaseClip {
  kind: "scene";
  effectId: string;
  background: SceneBackgroundSpec;
  opacity: number;
  soundCues?: EffectSoundCue[];
  sceneGroupId?: string;
  matchQuery?: string;
  dimAtUs?: number;
  lintOff?: string[];
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
  soundCues?: EffectSoundCue[];
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
  stylePreset?: SubtitleStylePreset;
  highlightWords?: string[];
  highlightColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundOpacity?: number;
  borderRadius?: number;
}

export type SubtitleStylePreset = "classic" | "bold" | "minimal";

export interface SubtitleStyleSettings {
  stylePreset: SubtitleStylePreset;
  highlightWords: string[];
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  backgroundOpacity: number;
  borderRadius: number;
}

export interface ChapterMarker {
  id: string;
  title: string;
  startUs: number;
}

export type ChapterProgressPreset = "top-dark" | "bottom-light" | "top-minimal" | "bottom-steps" | "bottom-labels" | "custom";
export type ChapterProgressPosition = "top" | "bottom";
export type ChapterProgressStyle = "segments" | "line" | "steps" | "labels";

export interface ChapterProgressSettings {
  enabled: boolean;
  preset: ChapterProgressPreset;
  position: ChapterProgressPosition;
  style: ChapterProgressStyle;
  backgroundColor: string;
  backgroundOpacity: number;
  activeColor: string;
  inactiveColor: string;
  textColor: string;
  height: number;
  showTitles: boolean;
  chapters: ChapterMarker[];
}

export type TimelineClip = VideoClip | ImageClip | AudioClip | SceneClip | EffectClip | GeneratedBlock | SubtitleClip;

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
  schemaVersion: 22;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; fpsNumerator: number; fpsDenominator: number };
  durationUs: number;
  chapterProgress: ChapterProgressSettings;
  presenterSafeArea: PresenterSafeAreaSettings;
  motionTheme: MotionTheme;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
}

export function createEmptyProject(): EditorProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 22,
    id: crypto.randomUUID(),
    name: "未命名项目",
    createdAt: now,
    updatedAt: now,
    canvas: { width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 },
    durationUs: 30_000_000,
    chapterProgress: {
      enabled: false,
      preset: "top-dark",
      position: "top",
      style: "segments",
      backgroundColor: "#111316",
      backgroundOpacity: 0.9,
      activeColor: "#ffb84d",
      inactiveColor: "#7d8793",
      textColor: "#ffffff",
      height: 80,
      showTitles: true,
      chapters: []
    },
    presenterSafeArea: { ...DEFAULT_PRESENTER_SAFE_AREA },
    motionTheme: structuredClone(DEFAULT_MOTION_THEME),
    assets: [],
    tracks: [
      { id: "video-layer-1", kind: "video", name: "视频", locked: false, muted: false, hidden: false, clips: [] },
      { id: "image-main", kind: "image", name: "贴图", locked: false, muted: false, hidden: false, clips: [] },
      { id: "generated-main", kind: "generated", name: "AI 内容", locked: false, muted: false, hidden: false, clips: [] },
      { id: "scene-main", kind: "scene", name: "场景", locked: false, muted: false, hidden: false, clips: [] },
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
