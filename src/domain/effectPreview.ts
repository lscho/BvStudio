import { compositionLayer, compositionSlots, mediaComposition, slotAccepts, type CompositionBinding } from "@/domain/compositions";
import { OVERLAY_STUDIO_EFFECT_IDS, compositionById, defaultEffectTransform, recommendedEffectFontSizeForId } from "@/domain/effects";
import type { CompositionClip, MediaAsset, MotionTheme } from "@/domain/project";
import { motionColorRoleForEffect, motionThemeAccentColor } from "@/domain/motionTheme";
import { DEFAULT_TRANSFORM } from "@/domain/transforms";
import { DEFAULT_EFFECT_BACKDROP } from "@/domain/videoPresentation";

function previewBindings(compositionId: string, assets: readonly MediaAsset[]): CompositionBinding[] {
  const slots = compositionSlots(compositionId);
  if (!slots.length) return [];
  const usedIds = new Set<string>();
  return slots.map((slot) => {
    const assetIds = assets
      .filter((asset) => !asset.missing && Boolean(asset.objectUrl) && !usedIds.has(asset.id) && slotAccepts(slot, asset.kind))
      .slice(0, slot.maxItems)
      .map((asset) => asset.id);
    assetIds.forEach((id) => usedIds.add(id));
    return { slotId: slot.id, assetIds };
  });
}

function previewPlaceholderUrl(theme: MotionTheme, width = 960, height = 540) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${theme.colors.surface}" fill-opacity=".16"/><rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="12" fill="none" stroke="${theme.colors.text}" stroke-opacity=".28" stroke-width="6" stroke-dasharray="18 14"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}#bvideo-placeholder`;
}

export interface EffectPreviewModel {
  clip: CompositionClip;
  assets: MediaAsset[];
}

export function createEffectPreviewModel(compositionId: string, theme: MotionTheme, assets: readonly MediaAsset[]): EffectPreviewModel {
  const previewAssets = [...assets];
  const slots = compositionSlots(compositionId);
  const usedIds = new Set<string>();
  for (const slot of slots) {
    const available = previewAssets
      .filter((asset) => !asset.missing && Boolean(asset.objectUrl) && !usedIds.has(asset.id) && slotAccepts(slot, asset.kind))
      .slice(0, slot.maxItems);
    available.forEach((asset) => usedIds.add(asset.id));
    const desired = Math.min(slot.maxItems, Math.max(slot.minItems, slot.kind === "video" ? 1 : 3));
    for (let index = available.length; index < desired; index += 1) {
      const documentPlaceholder = compositionId === "doc-scroll" && slot.id === "document";
      const width = documentPlaceholder ? 680 : 960;
      const height = documentPlaceholder ? 1_340 : 540;
      const placeholderId = `effect-demo:${compositionId}:${slot.id}:${index}`;
      previewAssets.push({
        id: placeholderId,
        name: "素材占位",
        kind: slot.kind === "video" ? "video" : "image",
        durationUs: 8_000_000,
        objectUrl: previewPlaceholderUrl(theme, width, height),
        width,
        height,
        hasAudio: false
      });
      usedIds.add(placeholderId);
    }
  }
  return { clip: createEffectPreviewClip(compositionId, theme, previewAssets), assets: previewAssets };
}

export function createEffectPreviewClip(compositionId: string, theme: MotionTheme, assets: readonly MediaAsset[]): CompositionClip {
  const definition = compositionById(compositionId);
  const material = mediaComposition(compositionId);
  return {
    id: `effect-library-preview:${compositionId}`,
    trackId: "effect-library-preview",
    kind: "composition",
    label: definition.name,
    startUs: 0,
    durationUs: definition.defaultDurationUs,
    locked: true,
    compositionId,
    bindings: previewBindings(compositionId, assets),
    sourceOffsetUs: 0,
    animationDurationUs: definition.defaultDurationUs,
    text: definition.defaultText,
    color: definition.defaultColor,
    accentColor: motionThemeAccentColor(theme),
    fontSize: recommendedEffectFontSizeForId(compositionId, definition.recipe, definition.defaultText),
    speed: 1,
    transform: material ? { ...DEFAULT_TRANSFORM } : defaultEffectTransform(compositionId),
    recipe: structuredClone(definition.recipe),
    params: structuredClone(definition.defaultParams ?? {}),
    soundCues: [],
    zIndex: compositionLayer({ compositionId, recipe: definition.recipe }),
    colorRole: motionColorRoleForEffect(compositionId),
    backdrop: { ...DEFAULT_EFFECT_BACKDROP, enabled: !OVERLAY_STUDIO_EFFECT_IDS.includes(compositionId as (typeof OVERLAY_STUDIO_EFFECT_IDS)[number]) }
  };
}
