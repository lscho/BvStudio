import type { TransformProps, VideoClip, VisualTransformKeyframe } from "@/domain/project";

export type VideoLayoutPresetId = NonNullable<VideoClip["layoutPreset"]>;

export const DEFAULT_TRANSFORM: TransformProps = { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };

export const VIDEO_LAYOUT_PRESETS: readonly { id: VideoLayoutPresetId; name: string; animated: boolean }[] = [
  { id: "full", name: "全屏主画面", animated: false },
  { id: "picture-in-picture-top-left", name: "左上角画中画", animated: false },
  { id: "picture-in-picture-top-right", name: "右上角画中画", animated: false },
  { id: "picture-in-picture-bottom-left", name: "左下角画中画", animated: false },
  { id: "picture-in-picture-bottom-right", name: "右下角画中画", animated: false },
  { id: "shrink-top-left", name: "缩小并移到左上角", animated: true },
  { id: "shrink-top-right", name: "缩小并移到右上角", animated: true },
  { id: "shrink-bottom-left", name: "缩小并移到左下角", animated: true },
  { id: "shrink-bottom-right", name: "缩小并移到右下角", animated: true },
  { id: "reveal-center", name: "从中心放大出现", animated: true },
  { id: "custom", name: "自定义关键帧", animated: true }
] as const;

function ease(progress: number, easing: VisualTransformKeyframe["easing"]) {
  if (easing === "ease-in") return progress * progress;
  if (easing === "ease-out") return 1 - (1 - progress) ** 2;
  if (easing === "ease-in-out") return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
  return progress;
}

export function visualTransformAt(base: TransformProps, keyframes: readonly VisualTransformKeyframe[] | undefined, offsetUs: number): TransformProps {
  const frames = [...(keyframes ?? [])].sort((left, right) => left.offsetUs - right.offsetUs);
  if (!frames.length) return base;
  if (offsetUs <= frames[0].offsetUs) return { ...base, x: frames[0].x, y: frames[0].y, scale: frames[0].scale };
  const last = frames.at(-1)!;
  if (offsetUs >= last.offsetUs) return { ...base, x: last.x, y: last.y, scale: last.scale };
  const rightIndex = frames.findIndex((frame) => frame.offsetUs >= offsetUs);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const progress = ease((offsetUs - left.offsetUs) / Math.max(1, right.offsetUs - left.offsetUs), right.easing);
  const interpolate = (from: number, to: number) => from + (to - from) * progress;
  return { ...base, x: interpolate(left.x, right.x), y: interpolate(left.y, right.y), scale: interpolate(left.scale, right.scale) };
}

export function upsertVisualKeyframe(keyframes: readonly VisualTransformKeyframe[] | undefined, offsetUs: number, transform: TransformProps): VisualTransformKeyframe[] {
  const roundedOffset = Math.max(0, Math.round(offsetUs));
  const next = [...(keyframes ?? [])];
  const existing = next.findIndex((frame) => Math.abs(frame.offsetUs - roundedOffset) <= 20_000);
  const frame: VisualTransformKeyframe = { offsetUs: roundedOffset, x: transform.x, y: transform.y, scale: transform.scale, easing: existing >= 0 ? next[existing].easing : "ease-in-out" };
  if (existing >= 0) next[existing] = frame;
  else next.push(frame);
  return next.sort((left, right) => left.offsetUs - right.offsetUs);
}

export function videoLayoutForPreset(id: VideoLayoutPresetId, durationUs: number): { transform: TransformProps; transformKeyframes: VisualTransformKeyframe[]; zIndex: number } {
  const corners: Record<string, Pick<TransformProps, "x" | "y" | "scale">> = {
    "top-left": { x: 18, y: 20, scale: 0.3 },
    "top-right": { x: 82, y: 20, scale: 0.3 },
    "bottom-left": { x: 18, y: 80, scale: 0.3 },
    "bottom-right": { x: 82, y: 80, scale: 0.3 }
  };
  if (id === "full") return { transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [], zIndex: 0 };
  if (id === "reveal-center") {
    const endUs = Math.min(800_000, Math.max(100_000, Math.round(durationUs * 0.25)));
    return { transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [{ offsetUs: 0, x: 50, y: 50, scale: 0.12, easing: "ease-out" }, { offsetUs: endUs, x: 50, y: 50, scale: 1, easing: "ease-out" }], zIndex: 10 };
  }
  const cornerName = id.replace("picture-in-picture-", "").replace("shrink-", "");
  const corner = corners[cornerName] ?? corners["top-right"];
  const transform = { ...DEFAULT_TRANSFORM, ...corner };
  if (id.startsWith("picture-in-picture")) return { transform, transformKeyframes: [], zIndex: 10 };
  if (id.startsWith("shrink")) {
    const endUs = Math.min(1_200_000, Math.max(200_000, Math.round(durationUs * 0.28)));
    return { transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [{ offsetUs: 0, x: 50, y: 50, scale: 1, easing: "ease-in-out" }, { offsetUs: endUs, ...corner, easing: "ease-in-out" }], zIndex: 10 };
  }
  return { transform: { ...DEFAULT_TRANSFORM }, transformKeyframes: [], zIndex: 10 };
}
