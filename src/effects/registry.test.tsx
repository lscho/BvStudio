import { describe, expect, it } from "vitest";
import { allEffects } from "@/domain/effects";
import { activeReactEffectDefinitions, effectControlsFor } from "@/effects/registry";
import type { EffectClip } from "@/domain/project";

describe("React effect registry", () => {
  it("exposes every active effect and its inspector controls", () => {
    const registered = activeReactEffectDefinitions();
    expect(registered.map((entry) => entry.definition.id)).toEqual(allEffects().map((effect) => effect.id));
    const clip = { effectId: registered[0].definition.id } as EffectClip;
    expect(effectControlsFor(clip).map((control) => control.field)).toEqual(["text", "color", "accentColor", "fontSize", "speed"]);
  });
});
