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

const demoPalettes = [
  ["#183b4a", "#4ecdc4", "#f7f8fa"],
  ["#402b3a", "#ff8c6b", "#fff4df"],
  ["#263748", "#73a9ff", "#e9f1ff"],
  ["#3c3829", "#f4c95d", "#fff8df"]
] as const;

function demoImageUrl(index: number) {
  const [background, accent, ink] = demoPalettes[index % demoPalettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${background}"/><rect x="56" y="52" width="848" height="436" rx="18" fill="none" stroke="${ink}" stroke-opacity=".26" stroke-width="4"/><circle cx="300" cy="232" r="96" fill="${accent}"/><path d="M144 438c54-112 151-168 290-168 116 0 208 42 276 126v42H144z" fill="${ink}" fill-opacity=".92"/><rect x="590" y="104" width="230" height="22" fill="${accent}"/><rect x="590" y="148" width="154" height="14" fill="${ink}" fill-opacity=".58"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface EffectPreviewModel {
  clip: CompositionClip;
  assets: MediaAsset[];
}

export function createEffectPreviewModel(compositionId: string, theme: MotionTheme, assets: readonly MediaAsset[]): EffectPreviewModel {
  const previewAssets = [...assets];
  const slots = compositionSlots(compositionId);
  let demoIndex = 0;
  for (const slot of slots) {
    const available = previewAssets.filter((asset) => !asset.missing && Boolean(asset.objectUrl) && slotAccepts(slot, asset.kind)).length;
    const desired = Math.min(slot.maxItems, Math.max(slot.minItems, slot.kind === "video" ? 1 : 3));
    for (let index = available; index < desired; index += 1) {
      previewAssets.push({
        id: `effect-demo:${compositionId}:${slot.id}:${index}`,
        name: "演示素材",
        kind: slot.kind === "video" ? "video" : "image",
        durationUs: 8_000_000,
        objectUrl: demoImageUrl(demoIndex),
        width: 960,
        height: 540,
        hasAudio: false
      });
      demoIndex += 1;
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
