import { DEFAULT_PRESENTER_SAFE_AREA, type CustomPresenterSafeArea, type PresenterSafeAreaSettings } from "@/domain/project";

export type PresenterAreaHandle = "move" | "nw" | "ne" | "sw" | "se";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizePresenterSafeArea(value: unknown): PresenterSafeAreaSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PRESENTER_SAFE_AREA };
  const widthPercent = clamp(finiteNumber("widthPercent" in value ? value.widthPercent : undefined, 32), 18, 60);
  const position = "position" in value ? value.position : "none";
  if (position !== "custom") return { position: position === "left" || position === "center" || position === "right" ? position : "none", widthPercent };
  const heightPercent = clamp(finiteNumber("heightPercent" in value ? value.heightPercent : undefined, 72), 18, 100);
  return {
    position,
    widthPercent,
    heightPercent,
    xPercent: clamp(finiteNumber("xPercent" in value ? value.xPercent : undefined, 50 - widthPercent / 2), 0, 100 - widthPercent),
    yPercent: clamp(finiteNumber("yPercent" in value ? value.yPercent : undefined, 6), 0, 100 - heightPercent)
  };
}

export function presenterSafeAreaGeometry(settings: PresenterSafeAreaSettings): CustomPresenterSafeArea {
  const normalized = normalizePresenterSafeArea(settings);
  if (normalized.position === "custom") return normalized;
  const { position, widthPercent } = normalized;
  return {
    position: "custom",
    xPercent: position === "left" ? 3 : position === "right" ? 97 - widthPercent : 50 - widthPercent / 2,
    yPercent: 6,
    widthPercent,
    heightPercent: 72
  };
}

export function adjustPresenterSafeArea(area: CustomPresenterSafeArea, handle: PresenterAreaHandle, deltaXPercent: number, deltaYPercent: number): CustomPresenterSafeArea {
  const start = presenterSafeAreaGeometry(area);
  const dx = finiteNumber(deltaXPercent, 0);
  const dy = finiteNumber(deltaYPercent, 0);
  if (handle === "move") return {
    ...start,
    xPercent: clamp(start.xPercent + dx, 0, 100 - start.widthPercent),
    yPercent: clamp(start.yPercent + dy, 0, 100 - start.heightPercent)
  };
  const right = start.xPercent + start.widthPercent;
  const bottom = start.yPercent + start.heightPercent;
  const left = handle.includes("w") ? clamp(start.xPercent + dx, Math.max(0, right - 60), right - 18) : start.xPercent;
  const top = handle.includes("n") ? clamp(start.yPercent + dy, 0, bottom - 18) : start.yPercent;
  const nextRight = handle.includes("e") ? clamp(right + dx, left + 18, Math.min(100, left + 60)) : right;
  const nextBottom = handle.includes("s") ? clamp(bottom + dy, top + 18, 100) : bottom;
  return { position: "custom", xPercent: left, yPercent: top, widthPercent: nextRight - left, heightPercent: nextBottom - top };
}
