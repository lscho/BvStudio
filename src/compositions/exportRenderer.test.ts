import { describe, expect, it } from "vitest";
import { configureReactOverlayHost, dynamicDurationUs, inlineReactOverlaySvgStyles } from "@/compositions/exportRenderer";
import type { RenderTextOverlay } from "@/services/media";

const overlay: RenderTextOverlay = {
  kind: "text", compositionId: "test-title-slide", renderer: "react", startUs: 0, durationUs: 3_000_000,
  text: "标题", color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, x: 50, y: 30, opacity: 1,
  scale: 1, rotation: 0, speed: 1, zIndex: 20,
  recipe: { layout: "panel", entrance: "fade-up", paddingX: 10, paddingY: 10, borderWidth: 1, borderRadius: 2, backgroundOpacity: 0.5 }
};

describe("React effect export timing", () => {
  it("keeps the capture host in the painted viewport behind the editor", () => {
    const host = document.createElement("div");
    configureReactOverlayHost(host, 1920, 1080);

    expect(host.style).toMatchObject({ left: "0px", top: "0px", zIndex: "-1", width: "1920px", height: "1080px" });
  });

  it("embeds SVG paint and text styles while preserving local gradient references", () => {
    const host = document.createElement("div");
    const style = document.createElement("style");
    style.textContent = ".export-test-ring { fill: none; stroke: rgb(95, 160, 250); stroke-width: 14px; } .export-test-label { fill: white; font-size: 28px; }";
    host.innerHTML = '<svg><defs><linearGradient id="area"><stop style="stop-color: rgb(95, 160, 250)" /></linearGradient></defs><circle class="export-test-ring" /><text class="export-test-label">42</text><path fill="url(#area)" /></svg>';
    document.head.append(style);
    document.body.append(host);
    try {
      const originalMarkup = host.innerHTML;
      const restore = inlineReactOverlaySvgStyles(host);
      const circle = host.querySelector("circle")!;
      expect(circle.style.fill).toBe("none");
      expect(circle.style.stroke).toBe("rgb(95, 160, 250)");
      expect(circle.style.strokeWidth).toBe("14px");
      expect(host.querySelector("text")!.style.fontSize).toBe("28px");
      expect(host.querySelector("path")!.getAttribute("fill")).toBe("url(#area)");
      expect(host.querySelector("path")!.style.fill).toBe("");
      restore();
      expect(host.innerHTML).toBe(originalMarkup);
    } finally {
      host.remove();
      style.remove();
    }
  });

  it("captures the deterministic entrance and optional dim point", () => {
    expect(dynamicDurationUs(overlay)).toBe(450_000);
    expect(dynamicDurationUs({ ...overlay, dimAtUs: 1_500_000 })).toBe(1_500_000);
    expect(dynamicDurationUs({ ...overlay, dimAtUs: 4_000_000 })).toBe(3_000_000);
  });

  it("captures the full registered motion of a dedicated React card", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "knowledge-causal-chain" })).toBe(1_200_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "knowledge-causal-chain", speed: 2 })).toBe(600_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "knowledge-quote-lines" })).toBe(1_550_000);
  });

  it("captures each replicated card through its authored duration", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "action-band", durationUs: 30_000_000 })).toBe(9_200_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "info-board", durationUs: 30_000_000 })).toBe(17_800_000);
  });

  it("captures continuously animated imported backgrounds for the whole clip", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "dust-field", durationUs: 30_000_000 })).toBe(30_000_000);
  });

  it("captures the complete subtitle-fitted animation window", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "pain-points", durationUs: 3_000_000, autoTiming: true })).toBe(3_000_000);
  });

  it("captures late subtitle reveals and the closing overview of full-stage information cards", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "glow-badges", durationUs: 26_000_000,
      params: { sceneLayout: "columns", revealTimesUs: "0|4000000|19000000" } })).toBe(26_000_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "quad-map", durationUs: 26_000_000,
      params: { sceneLayout: "matrix", revealTimesUs: "0|4000000|19000000" } })).toBe(26_000_000);
  });

  it("captures full persistent layers and parameter-driven animation timing", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "chapter-bar", durationUs: 30_000_000 })).toBe(30_000_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "caption-track", durationUs: 12_000_000 })).toBe(12_000_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "type-shift", durationUs: 4_000_000, params: { shiftAtMs: 3_000 } })).toBe(3_620_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "focus-card", durationUs: 10_000_000, params: { items: "一|二|三", stepMs: 1_000 } })).toBe(3_900_000);
  });

  it("does not freeze late reflow rows, long counters, or the terminal cursor", () => {
    expect(dynamicDurationUs({ ...overlay, compositionId: "type-shift", durationUs: 5_000_000, params: { shiftAtMs: 3_000, lines: "一｜二｜*三｜四｜五" } })).toBe(3_900_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "odometer", params: { value: 99999 } })).toBe(1_450_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "terminal-3d", durationUs: 6_000_000 })).toBe(6_000_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "punch-pill" })).toBeGreaterThanOrEqual(460_000);
    expect(dynamicDurationUs({ ...overlay, compositionId: "ui-callout" })).toBeGreaterThanOrEqual(1_080_000);
  });

  it("captures every staggered item with either supported pipe separator", () => {
    for (const compositionId of ["pin-board", "focus-card", "checklist", "blur-text", "step-timeline", "quote-lockup"]) {
      const field = compositionId === "blur-text" ? "blurText" : compositionId === "step-timeline" ? "steps" : compositionId === "quote-lockup" ? "quote" : "items";
      const base = { ...overlay, compositionId, durationUs: 30_000_000 };
      const latin = dynamicDurationUs({ ...base, params: { [field]: "one|two|three|four|five", stepMs: 2_000, staggerMs: 1_000 } });
      const chinese = dynamicDurationUs({ ...base, params: { [field]: "one｜two｜three｜four｜five", stepMs: 2_000, staggerMs: 1_000 } });
      expect(chinese, compositionId).toBe(latin);
    }
  });
});
