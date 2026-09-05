import { effectById, effectSelectionsForText, recommendedEffectFontSizeForId, type EffectDefinition } from "@/domain/effects";
import type { GeneratedEffectLayer, GeneratedScene } from "@/domain/project";

const AUTO_LAYOUT_SLOTS = {
  highlight: [
    { x: 50, y: 22, scale: 0.92 }, { x: 28, y: 34, scale: 0.78 }, { x: 72, y: 34, scale: 0.78 }, { x: 50, y: 82, scale: 0.72 }
  ],
  number: [
    { x: 76, y: 30, scale: 0.88 }, { x: 24, y: 30, scale: 0.82 }, { x: 76, y: 70, scale: 0.76 }, { x: 24, y: 70, scale: 0.76 }
  ],
  panel: [
    { x: 28, y: 56, scale: 0.78 }, { x: 72, y: 56, scale: 0.78 }, { x: 28, y: 76, scale: 0.68 }, { x: 72, y: 76, scale: 0.68 }
  ],
  underline: [
    { x: 50, y: 78, scale: 0.82 }, { x: 28, y: 68, scale: 0.72 }, { x: 72, y: 68, scale: 0.72 }, { x: 50, y: 88, scale: 0.66 }
  ],
  frame: [
    { x: 70, y: 57, scale: 0.78 }, { x: 30, y: 57, scale: 0.78 }, { x: 50, y: 34, scale: 0.7 }, { x: 50, y: 76, scale: 0.7 }
  ]
} as const;

export function suggestedEffectTransform(definition: EffectDefinition, occurrence = 0) {
  const slots = AUTO_LAYOUT_SLOTS[definition.recipe.layout];
  const slot = slots[occurrence % slots.length];
  const chartScale = definition.recipe.chart && definition.recipe.chart.kind !== "counter" ? Math.min(slot.scale, 0.7) : slot.scale;
  return {
    x: slot.x,
    y: slot.y,
    scale: chartScale,
    rotation: occurrence > 0 ? (occurrence % 2 ? -2 : 2) : 0,
    opacity: 1
  };
}

function isLegacyCenteredTransform(transform: GeneratedScene["transform"]) {
  return transform.x === 50
    && transform.y === 50
    && transform.scale === 1
    && transform.rotation === 0
    && transform.opacity === 1;
}

/** Repairs the old AI fallback that persisted every atomic effect at the canvas center. */
export function migrateLegacyGeneratedEffectLayout(scene: GeneratedScene): GeneratedScene {
  const additionalEffects = scene.additionalEffects ?? [];
  const automaticLayers = additionalEffects.filter((layer) => layer.source === "ai" || layer.source === "subtitle-match");
  if (automaticLayers.length === 0
    || effectById(scene.effectId).kind === "scene"
    || !isLegacyCenteredTransform(scene.transform)
    || !automaticLayers.every((layer) => effectById(layer.effectId).kind !== "scene" && isLegacyCenteredTransform(layer.transform))) return scene;

  const layoutOccurrences = new Map<EffectDefinition["recipe"]["layout"], number>();
  const nextTransform = (effectId: string) => {
    const definition = effectById(effectId);
    const occurrence = layoutOccurrences.get(definition.recipe.layout) ?? 0;
    layoutOccurrences.set(definition.recipe.layout, occurrence + 1);
    return suggestedEffectTransform(definition, occurrence);
  };
  return {
    ...scene,
    transform: nextTransform(scene.effectId),
    additionalEffects: additionalEffects.map((layer) => automaticLayers.includes(layer)
      ? { ...layer, transform: nextTransform(layer.effectId) }
      : layer)
  };
}

export function generatedSceneEffects(scene: GeneratedScene): GeneratedEffectLayer[] {
  const primary: GeneratedEffectLayer = {
    id: `${scene.id}:primary`,
    effectId: scene.effectId,
    text: scene.title,
    textColor: scene.textColor,
    accentColor: scene.accentColor,
    fontSize: scene.fontSize,
    speed: scene.speed,
    transform: scene.transform,
    startOffsetUs: 0,
    durationUs: scene.durationUs,
    zIndex: 20,
    source: "ai",
    matchQuery: `${scene.title} ${scene.narration}`.trim(),
    recipe: scene.recipe ?? structuredClone(effectById(scene.effectId).recipe),
    soundCues: structuredClone(effectById(scene.effectId).soundCues ?? [])
  };
  return [primary, ...(scene.additionalEffects ?? [])].sort((left, right) => left.zIndex - right.zIndex);
}

export function createGeneratedEffectLayers(
  effectIds: readonly string[],
  text: string,
  accentColor: string,
  durationUs: number,
  source: GeneratedEffectLayer["source"],
  matchQuery = text
): GeneratedEffectLayer[] {
  const layers: GeneratedEffectLayer[] = [];
  for (const selectedId of effectIds) {
    const selected = effectById(selectedId);
    const templates = selected.kind === "scene" && selected.sceneLayers?.length
      ? selected.sceneLayers.map((template) => ({ definition: effectById(template.effectId), template }))
      : [{ definition: selected, template: undefined }];
    for (const [index, { definition, template }] of templates.entries()) {
      const startOffsetUs = Math.round(durationUs * (template?.startRatio ?? 0));
      const availableUs = Math.max(100_000, durationUs - startOffsetUs);
      const sameLayoutCount = layers.filter((layer) => effectById(layer.effectId).recipe.layout === definition.recipe.layout).length;
      const suggestedTransform = suggestedEffectTransform(definition, sameLayoutCount);
      layers.push({
        id: crypto.randomUUID(),
        effectId: definition.id,
        text: template?.text ?? (layers.length === 0 && index === 0 ? text : definition.defaultText),
        textColor: definition.defaultColor,
        accentColor: selected.kind === "scene" ? selected.defaultAccentColor : accentColor || definition.defaultAccentColor,
        fontSize: template?.fontSize ?? recommendedEffectFontSizeForId(definition.id, definition.recipe, template?.text ?? text),
        speed: 1,
        transform: {
          x: template?.x ?? suggestedTransform.x,
          y: template?.y ?? suggestedTransform.y,
          scale: template?.scale ?? suggestedTransform.scale,
          rotation: template?.rotation ?? suggestedTransform.rotation,
          opacity: template?.opacity ?? 1
        },
        startOffsetUs,
        durationUs: Math.min(availableUs, Math.max(100_000, Math.round(durationUs * (template?.durationRatio ?? 1)))),
        zIndex: template?.zIndex ?? 20 + layers.length,
        source: selected.kind === "scene" ? "scene-template" : source,
        matchQuery,
        recipe: structuredClone(definition.recipe),
        soundCues: structuredClone(definition.soundCues ?? [])
      });
    }
  }
  return layers.slice(0, 8);
}

/** Stable local contract for matching timed subtitle text to a scene or multiple effect layers. */
export function effectIdsForSubtitle(text: string, limit = 3): string[] {
  return effectSelectionsForText(text, limit).map((effect: EffectDefinition) => effect.id);
}
