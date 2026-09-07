import type { VideoMask, VideoShape } from "@/domain/project";

export const DEFAULT_VIDEO_MASK: VideoMask = { shape: "rectangle", radius: 0, feather: 0, borderWidth: 0, borderColor: "#ffffff", focusX: 50, focusY: 50 };
const videoShapes: readonly VideoShape[] = ["rectangle", "rounded", "circle", "ellipse", "square", "portrait"];

export function normalizeVideoMask(value: unknown): VideoMask {
  const candidate = value && typeof value === "object" ? value : {};
  const field = (key: string): unknown => key in candidate ? Reflect.get(candidate, key) : undefined;
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = field(key);
    return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  };
  const dimension = (key: string) => typeof field(key) === "number" && Number.isFinite(field(key)) ? number(key, 100, 5, 100) : undefined;
  const color = field("borderColor");
  return {
    shape: videoShapes.find((shape) => shape === field("shape")) ?? "rectangle",
    radius: number("radius", 0, 0, 50), feather: number("feather", 0, 0, 40), borderWidth: number("borderWidth", 0, 0, 40),
    borderColor: typeof color === "string" && /^#[0-9a-f]{6}$/iu.test(color) ? color : DEFAULT_VIDEO_MASK.borderColor,
    focusX: number("focusX", 50, 0, 100), focusY: number("focusY", 50, 0, 100),
    widthPercent: dimension("widthPercent"), heightPercent: dimension("heightPercent")
  };
}

export function videoFrameSize(mask: VideoMask, canvasWidth: number, canvasHeight: number, sourceWidth?: number, sourceHeight?: number) {
  const normalized = normalizeVideoMask(mask);
  const sourceFrame = sourceVideoFrame(sourceWidth ?? 0, sourceHeight ?? 0, canvasWidth, canvasHeight);
  const hasSourceDimensions = [sourceWidth, sourceHeight].every((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  const width = canvasWidth * (hasSourceDimensions ? sourceFrame.widthPercent : normalized.widthPercent ?? 100) / 100;
  const height = canvasHeight * (hasSourceDimensions ? sourceFrame.heightPercent : normalized.heightPercent ?? 100) / 100;
  if (mask.shape === "circle" || mask.shape === "square") {
    const side = Math.min(width, height);
    return { width: side, height: side };
  }
  return { width, height };
}

export function videoFrameMask(mask: VideoMask, canvasWidth: number, canvasHeight: number, sourceWidth?: number, sourceHeight?: number): VideoMask {
  const normalized = normalizeVideoMask(mask);
  const frame = videoFrameSize(normalized, canvasWidth, canvasHeight, sourceWidth, sourceHeight);
  return {
    ...normalized,
    widthPercent: frame.width / canvasWidth * 100,
    heightPercent: frame.height / canvasHeight * 100
  };
}

export function sourceVideoFrame(sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number) {
  if (![sourceWidth, sourceHeight, canvasWidth, canvasHeight].every((value) => Number.isFinite(value) && value > 0)) return { widthPercent: 100, heightPercent: 100 };
  const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
  return { widthPercent: Math.max(5, sourceWidth * scale / canvasWidth * 100), heightPercent: Math.max(5, sourceHeight * scale / canvasHeight * 100) };
}
