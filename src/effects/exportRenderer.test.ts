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
});
