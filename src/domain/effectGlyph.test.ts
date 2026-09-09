import { describe, expect, it } from "vitest";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { EFFECT_GLYPH_KEYS, effectGlyphKey, type EffectGlyphKey } from "@/domain/effectGlyph";

const glyphKeys = new Set<string>(EFFECT_GLYPH_KEYS);

describe("effectGlyphKey", () => {
  it("gives every builtin effect a known glyph instead of a blank thumbnail", () => {
    for (const effect of BUILTIN_EFFECTS) {
      const glyph = effectGlyphKey(effect);
      expect(glyphKeys.has(glyph), `${effect.id} → ${glyph}`).toBe(true);
    }
  });

  it("covers the library with a varied set of glyphs and no generic fallback", () => {
    const counts = new Map<EffectGlyphKey, number>();
    for (const effect of BUILTIN_EFFECTS) {
      const glyph = effectGlyphKey(effect);
      counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(60);
    // ui-window 是“展示”类目的兜底图标；为 0 说明每个动效都命中了更具体的语义。
    expect(counts.get("ui-window") ?? 0).toBe(0);
  });

  it("maps representative effects to a glyph that matches the motion", () => {
    const glyphOf = (id: string) => {
      const effect = BUILTIN_EFFECTS.find((candidate) => candidate.id === id);
      expect(effect, `缺少动效 ${id}`).toBeTruthy();
      return effectGlyphKey(effect!);
    };
    expect(glyphOf("shotcraft-crash-zoom-real")).toBe("camera-push");
    expect(glyphOf("shotcraft-pull-back-isolation")).toBe("camera-pull");
    expect(glyphOf("shotcraft-bullet-time-freeze-orbit")).toBe("camera-orbit");
    expect(glyphOf("shotcraft-terminal-typewriter")).toBe("type-typewriter");
    expect(glyphOf("shotcraft-marker-underline-title")).toBe("type-underline");
    expect(glyphOf("shotcraft-scramble-decode")).toBe("type-glitch");
    expect(glyphOf("shotcraft-circle-match-iris")).toBe("transition-iris");
    expect(glyphOf("shotcraft-blinds-slice")).toBe("transition-wipe");
    expect(glyphOf("shotcraft-bento-light-up")).toBe("ui-grid");
    expect(glyphOf("shotcraft-deck-deal-flyin")).toBe("ui-stack");
    expect(glyphOf("shotcraft-halation-bloom")).toBe("light-glow");
    expect(glyphOf("shotcraft-voice-waveform-live")).toBe("media-audio");
    expect(glyphOf("shotcraft-odometer-digit-roll")).toBe("data-odometer");
    expect(glyphOf("shotcraft-timeline-travel")).toBe("data-timeline");
    expect(glyphOf("glass-pane")).toBe("background-glass");
    expect(glyphOf("icon-veto")).toBe("light-sweep");
    expect(glyphOf("versus-card")).toBe("ui-compare");
    expect(glyphOf("quote-lockup")).toBe("type-quote");
    expect(glyphOf("poster-wall-3d")).toBe("background-photo");
    expect(glyphOf("background-grid")).toBe("background-texture");
  });
});
