import { effectById, effectSelectionsForText, type EffectDefinition } from "@/domain/effects";
import type { GeneratedEffectLayer, GeneratedScene } from "@/domain/project";

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
    recipe: scene.recipe ?? structuredClone(effectById(scene.effectId).recipe)
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
      layers.push({
        id: crypto.randomUUID(),
        effectId: definition.id,
        text: template?.text ?? (layers.length === 0 && index === 0 ? text : definition.defaultText),
        textColor: definition.defaultColor,
        accentColor: selected.kind === "scene" ? selected.defaultAccentColor : accentColor || definition.defaultAccentColor,
        fontSize: template?.fontSize ?? 58,
        speed: 1,
        transform: {
          x: template?.x ?? 50,
          y: template?.y ?? 50,
          scale: template?.scale ?? 1,
          rotation: template?.rotation ?? 0,
          opacity: template?.opacity ?? 1
        },
        startOffsetUs,
        durationUs: Math.min(availableUs, Math.max(100_000, Math.round(durationUs * (template?.durationRatio ?? 1)))),
        zIndex: template?.zIndex ?? 20 + layers.length,
        source: selected.kind === "scene" ? "scene-template" : source,
        matchQuery,
        recipe: structuredClone(definition.recipe)
      });
    }
  }
  return layers.slice(0, 8);
}

/** Stable local contract for matching timed subtitle text to a scene or multiple effect layers. */
export function effectIdsForSubtitle(text: string, limit = 3): string[] {
  return effectSelectionsForText(text, limit).map((effect: EffectDefinition) => effect.id);
}
