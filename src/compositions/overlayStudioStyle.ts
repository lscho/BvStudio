import type { CSSProperties } from "react";
import { overlayStudioProgress } from "@/domain/overlayStudioMotion";

// One reference pixel is supplied by the preview/export host, including nested text.
export function studioLength(pixels: number) {
  return `calc(${pixels} * var(--os-unit, 1px))`;
}

export function studioEnterStyle(timeUs: number, startUs = 0, durationUs = 640_000, x = 0, y = 14): CSSProperties {
  const progress = overlayStudioProgress(timeUs, startUs, durationUs);
  return { opacity: progress, transform: `translate(${studioLength((1 - progress) * x)}, ${studioLength((1 - progress) * y)})` };
}
