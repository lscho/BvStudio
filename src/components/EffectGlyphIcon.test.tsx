import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { EFFECT_GLYPH_KEYS, effectGlyphKey } from "@/domain/effectGlyph";
import { EFFECT_GLYPH_ICONS, EffectGlyphIcon, effectGlyphFamily } from "@/components/EffectGlyphIcon";

describe("EffectGlyphIcon", () => {
  it("has a vector icon for every glyph key", () => {
    for (const glyph of EFFECT_GLYPH_KEYS) {
      expect(EFFECT_GLYPH_ICONS[glyph], `${glyph} 缺少图标`).toBeTruthy();
    }
  });

  it("renders a non-empty icon for every builtin effect", () => {
    const glyphs = BUILTIN_EFFECTS.map((effect) => effectGlyphKey(effect));
    const { container } = render(<div>{glyphs.map((glyph, index) => <EffectGlyphIcon key={`${glyph}-${index}`} glyph={glyph} />)}</div>);
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(BUILTIN_EFFECTS.length);
    for (const icon of icons) {
      expect(icon.querySelector("path, circle, rect, line, polyline, polygon")).not.toBeNull();
    }
  });

  it("keeps the swatch decoration family aligned with the glyph prefix", () => {
    for (const glyph of EFFECT_GLYPH_KEYS) {
      expect(effectGlyphFamily(glyph)).toBe(glyph.slice(0, glyph.indexOf("-")));
    }
  });
});
