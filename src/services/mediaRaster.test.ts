import { describe, expect, it, vi } from "vitest";
import { exportRasterDimension, rasterizeRenderPlan, type RenderTextOverlay } from "@/services/media";
import { createEmptyProject } from "@/domain/project";
import { buildRenderPlan } from "@/domain/renderPlan";

describe("export raster dimensions", () => {
  it("uses render-plan pixels instead of the display device pixel ratio", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    expect(exportRasterDimension(540)).toBe(540);
    expect(exportRasterDimension(540.2)).toBe(541);
    vi.unstubAllGlobals();
  });
  it("passes completed React disk sequences through without rasterizing their text again", async () => {
    const overlay: RenderTextOverlay = { kind: "text", renderer: "react", compositionId: "test-title-slide",
      startUs: 0, durationUs: 3_000_000, speed: 1, x: 50, y: 50, opacity: 1, scale: 1, rotation: 0, zIndex: 20,
      text: "已渲染", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, sequenceId: "sequence", sequenceFps: 30,
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 } };
    const plan = { ...buildRenderPlan(createEmptyProject(), "/out.mp4"), overlays: [overlay] };
    expect((await rasterizeRenderPlan(plan)).overlays[0]).toBe(overlay);
  });
});
