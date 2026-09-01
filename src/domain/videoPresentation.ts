import { cameraMotionForPreset } from "@/domain/camera";
import type { CameraMotion } from "@/domain/camera";
import type { EffectBackdrop, TransformProps, VideoClip, VideoFocusEffect, VideoMask, VideoMotionPresetId, VideoPresentationCue, VideoRole, VideoTransition } from "@/domain/project";
import { eased } from "@/domain/easing";
import { DEFAULT_TRANSFORM, videoLayoutForPreset, visualTransformAt } from "@/domain/transforms";

export const DEFAULT_VIDEO_MASK: VideoMask = { shape: "rectangle", radius: 0, feather: 0, borderWidth: 0, borderColor: "#ffffff", focusX: 50, focusY: 50 };
export const DEFAULT_VIDEO_TRANSITION: VideoTransition = { preset: "none", durationUs: 500_000, easing: "ease-in-out" };
export const DEFAULT_VIDEO_FOCUS: VideoFocusEffect = { enabled: false, startOffsetUs: 0, durationUs: 1_500_000, x: 50, y: 50, zoom: 1.8, radius: 14, feather: 6, dimOpacity: 0.58, showCursor: true };
export const DEFAULT_EFFECT_BACKDROP: EffectBackdrop = { enabled: true, color: "#111316", opacity: 0.64, blur: 8, paddingX: 18, paddingY: 10, radius: 4 };

export const VIDEO_ROLE_OPTIONS: readonly { value: VideoRole; label: string }[] = [
  { value: "a-roll", label: "A-roll 主叙事" },
  { value: "b-roll", label: "B-roll 补充画面" },
  { value: "presenter", label: "讲解人" },
  { value: "screen", label: "屏幕录制" },
  { value: "supporting", label: "辅助素材" },
  { value: "unspecified", label: "未指定" }
];

export type { VideoMotionPresetId } from "@/domain/project";

export const VIDEO_MOTION_PRESETS: readonly { id: VideoMotionPresetId; name: string; description: string }[] = [
  { id: "full-screen", name: "全屏显示", description: "恢复为铺满画布的标准画面" },
  { id: "zoom-to-full", name: "放大至全屏", description: "从居中小画面平滑放大" },
  { id: "presenter-circle-bottom-right", name: "讲解人右下角", description: "缩小、变圆并停靠到右下角" },
  { id: "picture-in-picture-top-right", name: "右上画中画", description: "圆角小窗从右侧进入" },
  { id: "split-left", name: "左侧分屏", description: "平滑移动到画面左半侧" },
  { id: "split-right", name: "右侧分屏", description: "平滑移动到画面右半侧" },
  { id: "slow-push-in", name: "缓慢推进", description: "知识讲解常用的轻微放大运镜" },
  { id: "screen-magnify", name: "区域放大", description: "放大屏幕局部，适合展示菜单和细节" },
  { id: "screen-spotlight", name: "聚光强调", description: "压暗周围内容，突出当前操作区域" },
  { id: "screen-focus", name: "聚焦放大", description: "同时放大并聚光鼠标操作区域" }
] as const;

export function videoMotionPresetUsesFocusPoint(id: VideoMotionPresetId): boolean {
  return id === "screen-magnify" || id === "screen-spotlight" || id === "screen-focus";
}

export interface VideoPresentationState {
  transform: TransformProps;
  mask: VideoMask;
  focus: VideoFocusEffect;
  camera: CameraMotion;
  cameraStartOffsetUs: number;
  cameraDurationUs: number;
  fit: "cover" | "contain";
  activeCueId?: string;
}

function targetTransform(id: VideoMotionPresetId, durationUs: number): TransformProps {
  if (id === "presenter-circle-bottom-right") {
    const layout = videoLayoutForPreset("presenter-bottom-right", durationUs);
    const target = visualTransformAt(layout.transform, layout.transformKeyframes, durationUs);
    return { x: target.x, y: target.y, scale: target.scale, rotation: target.rotation, opacity: target.opacity };
  }
  if (id === "picture-in-picture-top-right") return videoLayoutForPreset("picture-in-picture-top-right", durationUs).transform;
  if (id === "split-left" || id === "split-right") {
    const layout = videoLayoutForPreset(id, durationUs);
    const target = visualTransformAt(layout.transform, layout.transformKeyframes, durationUs);
    return { x: target.x, y: target.y, scale: target.scale, rotation: target.rotation, opacity: target.opacity };
  }
  return { ...DEFAULT_TRANSFORM };
}

export function videoMotionPresetTarget(id: VideoMotionPresetId, clip: VideoClip, offsetUs: number): Omit<VideoPresentationCue, "id" | "offsetUs" | "transitionDurationUs" | "presetId"> {
  const focusDurationUs = Math.max(100_000, clip.durationUs - offsetUs);
  const focus = id === "screen-magnify"
    ? { ...DEFAULT_VIDEO_FOCUS, enabled: true, startOffsetUs: offsetUs, durationUs: focusDurationUs, zoom: 2.25, radius: 18, feather: 7, dimOpacity: 0, showCursor: false }
    : id === "screen-spotlight"
      ? { ...DEFAULT_VIDEO_FOCUS, enabled: true, startOffsetUs: offsetUs, durationUs: focusDurationUs, zoom: 1, radius: 13, feather: 6, dimOpacity: 0.66, showCursor: false }
      : id === "screen-focus"
        ? { ...DEFAULT_VIDEO_FOCUS, enabled: true, startOffsetUs: offsetUs, durationUs: focusDurationUs, zoom: 1.85, radius: 15, feather: 6, dimOpacity: 0.42, showCursor: true }
        : { ...DEFAULT_VIDEO_FOCUS, enabled: false, startOffsetUs: offsetUs, durationUs: focusDurationUs };
  const mask = id === "presenter-circle-bottom-right"
    ? { ...DEFAULT_VIDEO_MASK, shape: "circle" as const, borderWidth: 3, borderColor: "#ffffff", focusY: 38 }
    : id === "picture-in-picture-top-right"
      ? { ...DEFAULT_VIDEO_MASK, shape: "rounded" as const, radius: 8, borderWidth: 2, borderColor: "#ffffff" }
      : { ...DEFAULT_VIDEO_MASK };
  return {
    transform: targetTransform(id, clip.durationUs),
    mask,
    focus,
    camera: id === "slow-push-in" ? cameraMotionForPreset("push-in") : cameraMotionForPreset("none"),
    fit: "cover"
  };
}

export function createVideoPresentationCue(id: VideoMotionPresetId, clip: VideoClip, offsetUs: number): VideoPresentationCue {
  const boundedOffsetUs = Math.max(0, Math.min(clip.durationUs - 1, Math.round(offsetUs)));
  const transitionDurationUs = Math.min(650_000, Math.max(100_000, clip.durationUs - boundedOffsetUs));
  return { id: crypto.randomUUID(), offsetUs: boundedOffsetUs, transitionDurationUs, presetId: id, ...videoMotionPresetTarget(id, clip, boundedOffsetUs) };
}

function interpolateTransform(from: TransformProps, to: TransformProps, progress: number): TransformProps {
  const amount = eased(Math.max(0, Math.min(1, progress)), "ease-in-out");
  const interpolate = (left: number, right: number) => left + (right - left) * amount;
  return {
    x: interpolate(from.x, to.x),
    y: interpolate(from.y, to.y),
    scale: interpolate(from.scale, to.scale),
    rotation: interpolate(from.rotation, to.rotation),
    opacity: interpolate(from.opacity, to.opacity)
  };
}

function legacyPresentationAt(clip: VideoClip, localUs: number): VideoPresentationState {
  return {
    transform: visualTransformAt(clip.transform ?? DEFAULT_TRANSFORM, clip.transformKeyframes, localUs),
    mask: videoMask(clip),
    focus: videoFocus(clip),
    camera: clip.camera,
    cameraStartOffsetUs: -(clip.cameraOffsetUs ?? 0),
    cameraDurationUs: clip.cameraDurationUs ?? clip.durationUs,
    fit: clip.fit
  };
}

function presentationAt(clip: VideoClip, localUs: number, cueLimit: number): VideoPresentationState {
  const cues = [...(clip.presentationCues ?? [])].sort((left, right) => left.offsetUs - right.offsetUs).slice(0, cueLimit);
  let activeIndex = -1;
  for (let index = cues.length - 1; index >= 0; index -= 1) {
    if (cues[index].offsetUs <= localUs) {
      activeIndex = index;
      break;
    }
  }
  if (activeIndex < 0) return legacyPresentationAt(clip, localUs);
  const cue = cues[activeIndex];
  const from = presentationAt(clip, cue.offsetUs, activeIndex);
  const progress = cue.transitionDurationUs <= 0 ? 1 : (localUs - cue.offsetUs) / cue.transitionDurationUs;
  return {
    transform: progress < 1 ? interpolateTransform(from.transform, cue.transform, progress) : { ...cue.transform },
    mask: { ...cue.mask },
    focus: { ...cue.focus },
    camera: cue.camera,
    cameraStartOffsetUs: cue.offsetUs,
    cameraDurationUs: Math.max(100_000, clip.durationUs - cue.offsetUs),
    fit: cue.fit,
    activeCueId: cue.id
  };
}

export function videoPresentationAt(clip: VideoClip, localUs: number): VideoPresentationState {
  return presentationAt(clip, Math.max(0, Math.min(clip.durationUs, localUs)), clip.presentationCues?.length ?? 0);
}

export function activeVideoPresentationCue(clip: VideoClip, localUs: number): VideoPresentationCue | undefined {
  return [...(clip.presentationCues ?? [])].sort((left, right) => right.offsetUs - left.offsetUs).find((cue) => cue.offsetUs <= localUs);
}

export function videoMotionPresetPatch(id: VideoMotionPresetId, clip: VideoClip): Partial<VideoClip> {
  const reset = {
    mask: { ...DEFAULT_VIDEO_MASK },
    transition: { ...DEFAULT_VIDEO_TRANSITION },
    focus: { ...DEFAULT_VIDEO_FOCUS, enabled: false, durationUs: clip.durationUs },
    camera: cameraMotionForPreset("none"),
    fit: "cover" as const
  };
  if (id === "full-screen") {
    return { ...reset, role: "a-roll", layoutPreset: "full", transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [], zIndex: 0 };
  }
  if (id === "zoom-to-full") {
    const endUs = Math.min(900_000, Math.max(200_000, Math.round(clip.durationUs * 0.22)));
    return {
      ...reset,
      role: "a-roll",
      layoutPreset: "custom",
      transform: { ...DEFAULT_TRANSFORM },
      transformKeyframes: [
        { offsetUs: 0, x: 50, y: 50, scale: 0.62, easing: "ease-in-out" },
        { offsetUs: endUs, x: 50, y: 50, scale: 1, easing: "ease-in-out" }
      ],
      transition: { ...DEFAULT_VIDEO_TRANSITION, preset: "zoom", durationUs: endUs },
      zIndex: 10
    };
  }
  if (id === "presenter-circle-bottom-right") {
    return {
      ...reset,
      ...videoLayoutForPreset("presenter-bottom-right", clip.durationUs),
      role: "presenter",
      layoutPreset: "presenter-bottom-right",
      mask: { ...DEFAULT_VIDEO_MASK, shape: "circle", borderWidth: 3, borderColor: "#ffffff", focusY: 38 },
      transition: { ...DEFAULT_VIDEO_TRANSITION, preset: "dock", durationUs: Math.min(650_000, clip.durationUs) },
      volume: Math.max(1, clip.volume)
    };
  }
  if (id === "picture-in-picture-top-right") {
    return {
      ...reset,
      ...videoLayoutForPreset("picture-in-picture-top-right", clip.durationUs),
      role: "b-roll",
      layoutPreset: "picture-in-picture-top-right",
      mask: { ...DEFAULT_VIDEO_MASK, shape: "rounded", radius: 8, borderWidth: 2, borderColor: "#ffffff" },
      transition: { ...DEFAULT_VIDEO_TRANSITION, preset: "slide-left", durationUs: Math.min(500_000, clip.durationUs) }
    };
  }
  if (id === "split-left" || id === "split-right") {
    return {
      ...reset,
      ...videoLayoutForPreset(id, clip.durationUs),
      role: "supporting",
      layoutPreset: id,
      transition: { ...DEFAULT_VIDEO_TRANSITION, preset: id === "split-left" ? "slide-right" : "slide-left", durationUs: Math.min(550_000, clip.durationUs) }
    };
  }
  if (id === "slow-push-in") {
    return { ...reset, role: "a-roll", layoutPreset: "full", transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [], camera: cameraMotionForPreset("push-in"), zIndex: 0 };
  }
  const focus = id === "screen-magnify"
    ? { ...DEFAULT_VIDEO_FOCUS, enabled: true, durationUs: clip.durationUs, zoom: 2.25, radius: 18, feather: 7, dimOpacity: 0, showCursor: false }
    : id === "screen-spotlight"
      ? { ...DEFAULT_VIDEO_FOCUS, enabled: true, durationUs: clip.durationUs, zoom: 1, radius: 13, feather: 6, dimOpacity: 0.66, showCursor: false }
      : { ...DEFAULT_VIDEO_FOCUS, enabled: true, durationUs: clip.durationUs, zoom: 1.85, radius: 15, feather: 6, dimOpacity: 0.42, showCursor: true };
  return {
    ...reset,
    role: "screen",
    layoutPreset: "full",
    transform: { ...DEFAULT_TRANSFORM },
    transformKeyframes: [],
    focus,
    volume: 0,
    zIndex: 0
  };
}

export function videoMask(clip: VideoClip): VideoMask {
  return { ...DEFAULT_VIDEO_MASK, ...clip.mask };
}

export function videoTransition(clip: VideoClip): VideoTransition {
  return { ...DEFAULT_VIDEO_TRANSITION, ...clip.transition };
}

export function videoFocus(clip: VideoClip): VideoFocusEffect {
  const durationUs = Math.max(100_000, Math.min(clip.durationUs, clip.focus?.durationUs ?? clip.durationUs));
  return { ...DEFAULT_VIDEO_FOCUS, durationUs, ...clip.focus };
}

export function focusEnvelope(focus: VideoFocusEffect, localUs: number): number {
  if (!focus.enabled || localUs < focus.startOffsetUs || localUs >= focus.startOffsetUs + focus.durationUs) return 0;
  const elapsed = localUs - focus.startOffsetUs;
  const remaining = focus.durationUs - elapsed;
  const rampUs = Math.min(300_000, Math.max(80_000, Math.round(focus.durationUs * 0.2)));
  const entering = Math.min(1, elapsed / rampUs);
  const exiting = Math.min(1, remaining / rampUs);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  return smooth(Math.min(entering, exiting));
}

export function transitionEnvelope(clip: VideoClip, localUs: number): number {
  const transition = videoTransition(clip);
  if (transition.preset === "none") return 1;
  const progress = Math.max(0, Math.min(1, localUs / Math.max(1, Math.min(transition.durationUs, clip.durationUs))));
  return eased(progress, transition.easing);
}
