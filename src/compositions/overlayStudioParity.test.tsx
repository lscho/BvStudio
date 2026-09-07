import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { replicatedOverlayStudioEffectIds } from "@/compositions/overlayStudioReference/adapter";
import { CompositionContent, effectCardChromeStyle, reactEffectDefinition, usesComponentChrome, usesFullCanvasComposition } from "@/compositions/registry";
import { allCompositions, OVERLAY_STUDIO_EFFECT_IDS, type CompositionParams } from "@/domain/effects";
import { importedOverlayStudioEffectIds } from "@/domain/overlayStudioCatalog";

function show(compositionId: string, timeUs: number, params: CompositionParams) {
  const definition = reactEffectDefinition(compositionId).definition;
  return render(<CompositionContent compositionId={compositionId} timeUs={timeUs} params={params}
    text="" color="#ffffff" accentColor="#5fa0fa" fontSize={48} recipe={definition.recipe}
    durationUs={10_000_000} canvasWidth={1920} canvasHeight={1080} />);
}

describe("Overlay Studio visual contracts", () => {
  it("registers every reference effect exactly once", () => {
    expect(OVERLAY_STUDIO_EFFECT_IDS).toHaveLength(102);
    expect(new Set(OVERLAY_STUDIO_EFFECT_IDS).size).toBe(102);
    expect(replicatedOverlayStudioEffectIds).toHaveLength(82);
    expect(new Set(replicatedOverlayStudioEffectIds).size).toBe(82);
    expect(new Set(replicatedOverlayStudioEffectIds)).toEqual(new Set(importedOverlayStudioEffectIds));

    const registered = new Set(allCompositions().map((definition) => definition.id));
    expect(OVERLAY_STUDIO_EFFECT_IDS.every((id) => registered.has(id))).toBe(true);
    expect(replicatedOverlayStudioEffectIds.every((id) => usesComponentChrome(id))).toBe(true);
    expect(replicatedOverlayStudioEffectIds.every((id) => usesFullCanvasComposition(id))).toBe(true);
  });

  it("renders imported cards in the reference stage at horizontal and vertical ratios", () => {
    const definition = reactEffectDefinition("action-band").definition;
    const common = {
      compositionId: definition.id,
      text: definition.defaultText,
      color: definition.defaultColor,
      accentColor: definition.defaultAccentColor,
      fontSize: 48,
      recipe: definition.recipe,
      durationUs: definition.defaultDurationUs,
      params: definition.defaultParams,
      timeUs: 2_000_000
    };
    const horizontal = renderToStaticMarkup(<CompositionContent {...common} canvasWidth={1920} canvasHeight={1080} />);
    const vertical = renderToStaticMarkup(<CompositionContent {...common} canvasWidth={1080} canvasHeight={1920} />);

    expect(horizontal).toContain("class=\"stage\"");
    expect(horizontal).toContain("data-ratio=\"h\"");
    expect(horizontal).toContain("该怎么做");
    expect(vertical).toContain("data-ratio=\"v\"");
  });

  it("keeps imported canvas effects on their native canvas renderer", () => {
    const definition = reactEffectDefinition("dust-field").definition;
    const markup = renderToStaticMarkup(<CompositionContent
      compositionId={definition.id}
      text={definition.defaultText}
      color={definition.defaultColor}
      accentColor={definition.defaultAccentColor}
      fontSize={48}
      recipe={definition.recipe}
      durationUs={definition.defaultDurationUs}
      params={definition.defaultParams}
      timeUs={2_000_000}
      canvasWidth={1920}
      canvasHeight={1080}
    />);
    expect(markup).toContain("class=\"df-canvas\"");
  });

  it("interpolates type hierarchy throughout the reflow, including when seeking backwards", () => {
    // happy-dom drops valid calc() lengths containing var(); inspect the emitted CSS.
    const at = (timeUs: number) => renderToStaticMarkup(<CompositionContent compositionId="type-shift" timeUs={timeUs}
      params={{ lines: "*重点", shiftAtMs: 1_600 }} text="" color="#fff" accentColor="#5fa0fa" fontSize={48}
      recipe={reactEffectDefinition("type-shift").definition.recipe} durationUs={4_000_000} canvasWidth={1920} />);
    const middle = at(1_910_000);
    expect(middle).toContain("var(--os-unit");
    const size = Number(middle.match(/font-size:calc\(([\d.]+)/)?.[1]);
    expect(size).toBeGreaterThan(40);
    expect(size).toBeLessThan(84);
    expect(at(1_500_000)).toContain("font-size:calc(40 *");
    expect(at(1_910_000)).toBe(middle);
  });

  it("switches adjacent captions without an opacity trough", () => {
    const { container } = show("caption-track", 1_000_000, { lines: "0|1|上一句|First\n1|2|下一句|Next" });
    expect(screen.queryByText("上一句")).not.toBeInTheDocument();
    expect(screen.getByText("下一句")).toBeInTheDocument();
    const caption = container.querySelector<HTMLElement>(".ctrack");
    expect(caption?.style.opacity).not.toBe("0");
    expect(caption?.style.transform ?? "").toBe("");
  });

  it("changes reflow weight and line height when the phase switches, before delayed size transitions", () => {
    show("type-shift", 1_600_000, { lines: "引子|*重点", shiftAtMs: 1_600 });
    const hero = screen.getByText("重点");
    expect(hero.style.fontWeight).toBe("800");
    expect(hero.style.lineHeight).toBe("1.3");
  });

  it("keeps the ring's original radius and weight with its label below the ring", () => {
    const { container } = show("ring-metric", 1_500_000, { value: 92.4, label: "完成率" });
    const circle = container.querySelector(".rm-prog");
    expect(circle).toHaveAttribute("r", "140");
    expect(circle).toHaveAttribute("stroke-width", "14");
    expect(container.querySelector(".rm-center")).not.toContainElement(screen.getByText("完成率"));
  });

  it("preserves terminal indentation and blank lines while typing", () => {
    const { container } = show("terminal-3d", 2_000_000, { lines: "$ build||  done", cps: 26 });
    const lines = container.querySelectorAll(".t3-line");
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toBe("$ build");
    expect(lines[1].textContent?.trim()).toBe("");
    expect(lines[2].textContent).toBe("  done");
  });

  it("counts ranks with the original 1400 ms exponential clock", () => {
    show("rank-bars", 700_000, { rows: "第一项,100|第二项,50", suffix: "%" });
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("48%")).toBeInTheDocument();
  });

  it("preserves the pin's scale overshoot separately from opacity", () => {
    show("pin-board", 650_000, { items: "要点", stepMs: 4_000 });
    const chip = screen.getByText("要点");
    const scale = Number(chip.style.transform.match(/scale\(([\d.]+)\)/)?.[1]);
    expect(scale).toBeGreaterThan(1);
    expect(Number(chip.style.opacity)).toBeLessThanOrEqual(1);
  });

  it("retains the growth chart's original coordinate system and gradient area", () => {
    const { container } = show("growth-curve", 1_900_000, { points: "一月 12|二月 66", unit: "张" });
    expect(screen.getByRole("img", { name: "增长曲线" })).toHaveAttribute("viewBox", "0 0 640 310");
    expect(container.querySelector("linearGradient stop")).toHaveAttribute("stop-opacity", "0.38");
  });

  it("provides the same reference-pixel unit for preview and export", () => {
    const recipe = reactEffectDefinition("quote-lockup").definition.recipe;
    const clip = { color: "#fff", accentColor: "#5fa0fa", fontSize: 48 };
    const exported = effectCardChromeStyle(clip, recipe, (pixels) => `${pixels}px`, undefined, true);
    const previewed = effectCardChromeStyle(clip, recipe, (pixels) => `${pixels / 1920 * 100}cqw`, undefined, true);
    expect(exported).toHaveProperty("--os-unit", "1px");
    expect(previewed).toHaveProperty("--os-unit", `${100 / 1920}cqw`);
  });
});
