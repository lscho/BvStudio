import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { allEffects } from "@/domain/effects";
import { activeReactEffectDefinitions, EffectCardContent, effectControlsFor, reactEffectDefinition, reactEffectMotionDurationUs } from "@/effects/registry";
import type { EffectClip } from "@/domain/project";

describe("React effect registry", () => {
  it("exposes every active effect and its inspector controls", () => {
    const registered = activeReactEffectDefinitions();
    expect(registered.map((entry) => entry.definition.id)).toEqual(allEffects().map((effect) => effect.id));
    const clip = { effectId: registered[0].definition.id } as EffectClip;
    expect(effectControlsFor(clip).map((control) => control.field)).toEqual(["text", "color", "accentColor", "fontSize", "speed"]);
  });

  it("maps knowledge effects to dedicated deterministic components", () => {
    expect(reactEffectDefinition("knowledge-concept-map").component.name).toBe("ConceptMapCard");
    expect(reactEffectDefinition("knowledge-causal-chain").component.name).toBe("CausalChainCard");
    expect(reactEffectDefinition("knowledge-argument-board").component.name).toBe("ArgumentBoardCard");
    expect(reactEffectDefinition("knowledge-myth-fact").component.name).toBe("MythFactCard");
    expect(reactEffectDefinition("knowledge-quote-lines").component.name).toBe("QuoteLinesCard");
    expect(effectControlsFor({ effectId: "knowledge-causal-chain" } as EffectClip)[0]).toEqual(expect.objectContaining({ label: "内容（用｜分隔）", rows: 4 }));
    expect(reactEffectMotionDurationUs("knowledge-causal-chain")).toBe(1_200_000);
  });

  it("renders the same knowledge frame for the same virtual time", () => {
    const props = {
      effectId: "knowledge-myth-fact", text: "越复杂越专业｜清晰比复杂更重要", color: "#ffffff", accentColor: "#ff7b72",
      fontSize: 48, recipe: reactEffectDefinition("knowledge-myth-fact").definition.recipe, durationUs: 4_000_000, canvasWidth: 1920
    };
    const early = renderToStaticMarkup(<EffectCardContent {...props} timeUs={0} />);
    const complete = renderToStaticMarkup(<EffectCardContent {...props} timeUs={950_000} />);
    expect(early).not.toBe(complete);
    expect(complete).toBe(renderToStaticMarkup(<EffectCardContent {...props} timeUs={950_000} />));
    expect(complete).toContain("knowledge-myth-fact");
    expect(complete).toContain("清晰比复杂更重要");
  });

  it("renders a title and multiple quote lines at deterministic staggered times", () => {
    const definition = reactEffectDefinition("knowledge-quote-lines").definition;
    const props = {
      effectId: definition.id, text: "关于长期主义｜真正重要的不是走得多快｜而是始终走在正确的方向", color: "#ffffff", accentColor: "#ffb84d",
      fontSize: 48, recipe: definition.recipe, durationUs: definition.defaultDurationUs, canvasWidth: 1920
    };
    const early = renderToStaticMarkup(<EffectCardContent {...props} timeUs={350_000} />);
    const complete = renderToStaticMarkup(<EffectCardContent {...props} timeUs={1_550_000} />);
    expect(early).not.toBe(complete);
    expect(complete).toBe(renderToStaticMarkup(<EffectCardContent {...props} timeUs={1_550_000} />));
    expect(complete).toContain("关于长期主义");
    expect(complete).toContain("真正重要的不是走得多快");
    expect(complete).toContain("而是始终走在正确的方向");
  });
});
