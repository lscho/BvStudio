import type { CompositionParams } from "@/domain/effects";
import type { TransformProps } from "@/domain/project";
import { importedOverlayStudioEffectIds } from "@/domain/overlayStudioCatalog";

const nativeOverlayStudioEffectIds = new Set([
  "quote-lockup", "step-timeline", "rank-bars", "punch-pill", "term-card", "checklist", "terminal-3d", "ring-metric", "versus-card", "ui-callout",
  "type-shift", "blur-text", "odometer", "focus-card", "chapter-bar", "caption-track", "stat-proof", "growth-curve", "entity-chips", "pin-board"
]);

const importedOverlayStudioEffectIdSet = new Set<string>(importedOverlayStudioEffectIds);

export function isReferenceStageComposition(compositionId: string) {
  return importedOverlayStudioEffectIdSet.has(compositionId) && !nativeOverlayStudioEffectIds.has(compositionId);
}

export function referenceStageOuterTransform(transform: TransformProps): TransformProps {
  return { ...transform, x: 50, y: 50, scale: 1, rotation: 0 };
}

function finiteParam(params: CompositionParams | undefined, key: string, fallback: number) {
  const value = params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function referenceStageInteractionPatch(
  params: CompositionParams | undefined,
  nextTransform: TransformProps,
  canvas: { width: number; height: number }
) {
  return {
    transform: referenceStageOuterTransform(nextTransform),
    transformKeyframes: [],
    params: {
      ...params,
      offsetX: Math.round(finiteParam(params, "offsetX", 0) + (nextTransform.x - 50) / 100 * canvas.width),
      offsetY: Math.round(finiteParam(params, "offsetY", 0) + (nextTransform.y - 50) / 100 * canvas.height),
      scale: Math.max(0.3, Math.min(3, finiteParam(params, "scale", 1) * nextTransform.scale))
    }
  };
}
