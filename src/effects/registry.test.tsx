import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { allEffects, OVERLAY_STUDIO_EFFECT_IDS } from "@/domain/effects";
import { activeReactEffectDefinitions, EffectCardContent, effectControlsFor, reactEffectDefinition, reactEffectMotionDurationUs } from "@/effects/registry";
import type { EffectClip } from "@/domain/project";

describe("React effect registry", () => {
  it("exposes every active effect and its inspector controls", () => {
    const registered = activeReactEffectDefinitions();
    expect(registered.map((entry) => entry.definition.id)).toEqual(allEffects().map((effect) => effect.id));
    const clip = { effectId: registered[0].definition.id } as EffectClip;
    expect(effectControlsFor(clip).map((control) => control.field)).toEqual(["theme", "quote", "author", "color", "accentColor", "fontSize", "speed"]);
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

  it("maps talking-head effects to dedicated deterministic components", () => {
    expect(reactEffectDefinition("pin-board").component.name).toBe("PinBoardCard");
    expect(reactEffectDefinition("checklist").component.name).toBe("ChecklistCard");
    expect(reactEffectDefinition("versus-card").component.name).toBe("VersusCard");
    expect(reactEffectDefinition("entity-chips").component.name).toBe("EntityChipsCard");
    expect(reactEffectDefinition("stat-proof").component.name).toBe("StatProofCard");
    expect(effectControlsFor({ effectId: "pin-board" } as EffectClip)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "param-text", field: "title" }),
      expect.objectContaining({ kind: "param-text", field: "items" }),
      expect.objectContaining({ kind: "param-range", field: "stepMs" })
    ]));
  });

  it("maps all migrated effects to dedicated deterministic components", () => {
    expect(OVERLAY_STUDIO_EFFECT_IDS.every((id) => reactEffectDefinition(id).component.name !== "GenericEffectCard")).toBe(true);
    expect(effectControlsFor({ effectId: "ring-metric" } as EffectClip)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "param-range", field: "value" }),
      expect.objectContaining({ kind: "param-text", field: "unit" })
    ]));
  });

  it("renders every migrated effect from its persisted defaults", () => {
    for (const id of OVERLAY_STUDIO_EFFECT_IDS) {
      const definition = reactEffectDefinition(id).definition;
      const props = {
        effectId: id,
        text: definition.defaultText,
        color: definition.defaultColor,
        accentColor: definition.defaultAccentColor,
        fontSize: 48,
        recipe: definition.recipe,
        durationUs: definition.defaultDurationUs,
        canvasWidth: 1920,
        params: definition.defaultParams,
        timeUs: Math.min(definition.defaultDurationUs - 1, 2_000_000)
      };
      const first = renderToStaticMarkup(<EffectCardContent {...props} />);
      expect(first.length, id).toBeGreaterThan(20);
      expect(renderToStaticMarkup(<EffectCardContent {...props} />), id).toBe(first);
    }
  });

  it("renders timeline-aware persistent effects deterministically", () => {
    const chapter = reactEffectDefinition("chapter-bar").definition;
    const params = chapter.defaultParams;
    const base = { effectId: chapter.id, text: chapter.defaultText, color: chapter.defaultColor, accentColor: chapter.defaultAccentColor, fontSize: 48, recipe: chapter.recipe, durationUs: chapter.defaultDurationUs, canvasWidth: 1920, params };
    const opening = renderToStaticMarkup(<EffectCardContent {...base} timeUs={2_000_000} />);
    const middle = renderToStaticMarkup(<EffectCardContent {...base} timeUs={16_000_000} />);
    expect(opening).not.toBe(middle);
    expect(middle).toBe(renderToStaticMarkup(<EffectCardContent {...base} timeUs={16_000_000} />));
    expect(middle).toContain("核心内容");
  });

  it("reveals persistent talking points from the playhead without wall-clock animation", () => {
    const definition = reactEffectDefinition("pin-board").definition;
    const props = {
      effectId: definition.id, text: "内容框架｜先讲结论｜补充证据｜给出行动", color: "#ffffff", accentColor: "#5fa8ff",
      fontSize: 48, recipe: definition.recipe, durationUs: definition.defaultDurationUs, canvasWidth: 1920
    };
    const early = renderToStaticMarkup(<EffectCardContent {...props} timeUs={120_000} />);
    const complete = renderToStaticMarkup(<EffectCardContent {...props} timeUs={1_900_000} />);
    expect(early).not.toBe(complete);
    expect(complete).toBe(renderToStaticMarkup(<EffectCardContent {...props} timeUs={1_900_000} />));
    expect(complete).toContain("先讲结论");
    expect(complete).toContain("给出行动");
  });

  it("keeps explicit signs and units in animated proof statistics", () => {
    const definition = reactEffectDefinition("stat-proof").definition;
    const markup = renderToStaticMarkup(<EffectCardContent
      effectId={definition.id}
      text="+42%｜同比增长｜来源：公开数据"
      color="#ffffff"
      accentColor="#47d7ac"
      fontSize={48}
      recipe={definition.recipe}
      timeUs={1_300_000}
      durationUs={definition.defaultDurationUs}
      canvasWidth={1920}
    />);
    expect(markup).toContain("spf-fix\">+</span>42");
    expect(markup).toContain("%");
    expect(markup).toContain("来源：公开数据");
  });

  it("renders real odometer reels with all ten digits", () => {
    const definition = reactEffectDefinition("odometer").definition;
    const markup = renderToStaticMarkup(<EffectCardContent
      effectId={definition.id} text={definition.defaultText} color={definition.defaultColor} accentColor={definition.defaultAccentColor}
      fontSize={48} recipe={definition.recipe} params={{ ...definition.defaultParams, value: 507 }} timeUs={1_500_000}
      durationUs={definition.defaultDurationUs} canvasWidth={1920} canvasHeight={1080}
    />);
    expect(markup.match(/class="od-reel"/gu)).toHaveLength(3);
    expect(markup.match(/class="od-d"/gu)).toHaveLength(30);
    expect(markup).toContain("translateY(-5.75em)");
  });

  it("preserves checklist, versus, entity, and focus-card reference states", () => {
    const render = (effectId: string, params: Record<string, string | number | boolean>) => {
      const definition = reactEffectDefinition(effectId).definition;
      return renderToStaticMarkup(<EffectCardContent
        effectId={effectId} text={definition.defaultText} color={definition.defaultColor} accentColor={definition.defaultAccentColor}
        fontSize={48} recipe={definition.recipe} params={params} timeUs={2_000_000}
        durationUs={definition.defaultDurationUs} canvasWidth={1920} canvasHeight={1080}
      />);
    };
    expect(render("checklist", { title: "清单", items: "完成项|待办项", checked: 1, stepMs: 160 })).toContain("is-todo");
    expect(render("versus-card", { aTitle: "A", bTitle: "B", winner: "b" })).toContain("vs-side a is-dim");
    const entities = render("entity-chips", { chips: "light|机构|ORG\ndark|人物|CEO", note: "代码|身份", stepMs: 0 });
    expect(entities).toContain("etc-chip--light");
    expect(entities).toContain("etc-chip--dark");
    const focus = render("focus-card", { bg: "mist", side: "right", items: "要点", showRing: true, camW: 700, camH: 700 });
    expect(focus).toContain("data-bg=\"mist\"");
    expect(focus).toContain("fcd-ring");
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
