export type CameraEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface CameraMotion {
  preset: CameraPresetId;
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  easing: CameraEasing;
}

export type CameraPresetId = "none" | "push-in" | "pull-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "push-left" | "push-right" | "drift-up" | "drift-down" | "ken-burns-left" | "ken-burns-right";

export interface CameraPreset {
  id: CameraPresetId;
  name: string;
  description: string;
  motion: Omit<CameraMotion, "preset">;
}

const motion = (startScale: number, endScale: number, startX = 0, endX = 0, startY = 0, endY = 0, easing: CameraEasing = "ease-in-out"): Omit<CameraMotion, "preset"> => ({
  startScale, endScale, startX, endX, startY, endY, easing
});

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  { id: "none", name: "固定镜头", description: "不做镜头移动", motion: motion(1, 1, 0, 0, 0, 0, "linear") },
  { id: "push-in", name: "缓慢推进", description: "逐渐放大主体", motion: motion(1, 1.22, 0, 0, 0, 0, "ease-in-out") },
  { id: "pull-out", name: "缓慢拉远", description: "从近景回到全景", motion: motion(1.22, 1, 0, 0, 0, 0, "ease-out") },
  { id: "pan-left", name: "向左横移", description: "镜头平稳向左移动", motion: motion(1.16, 1.16, 55, -55) },
  { id: "pan-right", name: "向右横移", description: "镜头平稳向右移动", motion: motion(1.16, 1.16, -55, 55) },
  { id: "pan-up", name: "向上摇镜", description: "镜头由下向上移动", motion: motion(1.16, 1.16, 0, 0, 55, -55) },
  { id: "pan-down", name: "向下摇镜", description: "镜头由上向下移动", motion: motion(1.16, 1.16, 0, 0, -55, 55) },
  { id: "push-left", name: "左移推进", description: "推进同时向左构图", motion: motion(1.02, 1.25, 35, -35, 0, 0) },
  { id: "push-right", name: "右移推进", description: "推进同时向右构图", motion: motion(1.02, 1.25, -35, 35, 0, 0) },
  { id: "drift-up", name: "上浮推进", description: "轻微放大并向上移动", motion: motion(1.04, 1.2, 0, 0, 35, -35) },
  { id: "drift-down", name: "下沉拉远", description: "轻微拉远并向下移动", motion: motion(1.2, 1.04, 0, 0, -35, 35) },
  { id: "ken-burns-left", name: "左向肯伯恩", description: "照片式慢推与横移", motion: motion(1.08, 1.28, 45, -45, 20, -20, "linear") },
  { id: "ken-burns-right", name: "右向肯伯恩", description: "照片式慢推与反向横移", motion: motion(1.08, 1.28, -45, 45, -20, 20, "linear") }
] as const;

export function cameraMotionForPreset(id: CameraPresetId): CameraMotion {
  const preset = CAMERA_PRESETS.find((candidate) => candidate.id === id) ?? CAMERA_PRESETS[0];
  return { preset: preset.id, ...preset.motion };
}

function ease(progress: number, easing: CameraEasing) {
  if (easing === "ease-in") return progress * progress;
  if (easing === "ease-out") return 1 - (1 - progress) ** 2;
  if (easing === "ease-in-out") return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
  return progress;
}

export function cameraStateAt(motionValue: CameraMotion, progress: number) {
  const value = ease(Math.max(0, Math.min(1, progress)), motionValue.easing);
  const interpolate = (start: number, end: number) => start + (end - start) * value;
  return {
    scale: interpolate(motionValue.startScale, motionValue.endScale),
    x: interpolate(motionValue.startX, motionValue.endX),
    y: interpolate(motionValue.startY, motionValue.endY)
  };
}
