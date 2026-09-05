import { describe, expect, it } from "vitest";
import { dynamicDurationUs } from "@/effects/exportRenderer";
import type { RenderTextOverlay } from "@/services/media";

const overlay: RenderTextOverlay = {
  kind: "text", effectId: "test-title-slide", renderer: "react", startUs: 0, durationUs: 3_000_000,
  text: "标题", color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, x: 50, y: 30, opacity: 1,
  scale: 1, rotation: 0, speed: 1, zIndex: 20,
  recipe: { layout: "panel", entrance: "fade-up", paddingX: 10, paddingY: 10, borderWidth: 1, borderRadius: 2, backgroundOpacity: 0.5 }
};

describe("React effect export timing", () => {
  it("captures the deterministic entrance and optional dim point", () => {
    expect(dynamicDurationUs(overlay)).toBe(450_000);
    expect(dynamicDurationUs({ ...overlay, dimAtUs: 1_500_000 })).toBe(1_500_000);
    expect(dynamicDurationUs({ ...overlay, dimAtUs: 4_000_000 })).toBe(3_000_000);
  });

  it("captures the full registered motion of a dedicated React card", () => {
    expect(dynamicDurationUs({ ...overlay, effectId: "knowledge-causal-chain" })).toBe(1_200_000);
    expect(dynamicDurationUs({ ...overlay, effectId: "knowledge-causal-chain", speed: 2 })).toBe(600_000);
    expect(dynamicDurationUs({ ...overlay, effectId: "knowledge-quote-lines" })).toBe(1_550_000);
  });

  it("captures full persistent layers and parameter-driven animation timing", () => {
    expect(dynamicDurationUs({ ...overlay, effectId: "chapter-bar", durationUs: 30_000_000 })).toBe(30_000_000);
    expect(dynamicDurationUs({ ...overlay, effectId: "caption-track", durationUs: 12_000_000 })).toBe(12_000_000);
    expect(dynamicDurationUs({ ...overlay, effectId: "type-shift", durationUs: 4_000_000, params: { shiftAtMs: 3_000 } })).toBe(3_500_000);
    expect(dynamicDurationUs({ ...overlay, effectId: "focus-card", durationUs: 10_000_000, params: { items: "一|二|三", stepMs: 1_000 } })).toBe(3_900_000);
  });
});
