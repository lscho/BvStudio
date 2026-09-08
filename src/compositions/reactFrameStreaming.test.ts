import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { rasterizeCompositions } from "@/compositions/exportRenderer";
import { buildRenderPlan } from "@/domain/renderPlan";
import { createEmptyProject } from "@/domain/project";
import type { RenderTextOverlay } from "@/services/media";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function setup() {
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { queueMicrotask(() => callback(0)); return 1; });
  vi.mocked(toPng).mockResolvedValue("data:image/png;base64,frame");
  const overlay: RenderTextOverlay = {
    kind: "composition", renderer: "react", compositionId: "shotcraft-blur-slide",
    text: "测试", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, startUs: 0, durationUs: 100_000,
    speed: 2, x: 50, y: 50, opacity: 1, scale: 1, rotation: 0, zIndex: 220,
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  };
  const plan = { ...buildRenderPlan(createEmptyProject(), "/output.mp4"), fps: 30, overlays: [overlay] };
  const sink = { begin: vi.fn().mockResolvedValue("react-sequence"), append: vi.fn().mockResolvedValue(undefined), release: vi.fn().mockResolvedValue(undefined) };
  return { plan, sink };
}

describe("React frame streaming", () => {
  it("writes each frame before rendering the next and returns a disk sequence without PNG arrays", async () => {
    const { plan, sink } = setup();
    const order: string[] = [];
    vi.mocked(toPng).mockImplementation(async () => { order.push("render"); return "data:image/png;base64,frame"; });
    sink.append.mockImplementation(async () => { order.push("write"); });
    const sequences: string[] = [];
    const result = await rasterizeCompositions(plan, { sink, sequences });
    expect(order).toEqual(Array.from({ length: 3 }, () => ["render", "write"]).flat());
    expect(sink.append).toHaveBeenCalledTimes(Math.ceil(plan.overlays[0].durationUs / 1_000_000 * plan.fps));
    expect(sequences).toEqual(["react-sequence"]);
    expect(result.overlays[0]).toMatchObject({ sequenceId: "react-sequence", sequenceFps: 30, speed: 1 });
    expect(result.overlays[0]).not.toHaveProperty("sequenceFramesBase64");
    expect(document.querySelector(".effect-overlay")).toBeNull();
  });

  it("writes the full native frame count while reusing the final static image of a short entrance", async () => {
    const { plan, sink } = setup();
    plan.overlays[0] = { ...plan.overlays[0], compositionId: "test-title-slide", durationUs: 2_000_000, speed: 1,
      recipe: { ...plan.overlays[0].recipe, entrance: "fade-up" } };
    vi.mocked(toPng).mockClear();
    await rasterizeCompositions(plan, { sink, sequences: [] });
    expect(sink.append).toHaveBeenCalledTimes(60);
    expect(sink.append).toHaveBeenLastCalledWith("react-sequence", 59, "frame");
    expect(vi.mocked(toPng).mock.calls.length).toBeLessThan(60);
    expect(vi.mocked(toPng).mock.calls.length).toBeGreaterThan(1);
  });

  it.each(["cancel", "disk"])("cleans the DOM and retains the sequence for caller cleanup on %s", async (mode) => {
    const { plan, sink } = setup();
    const controller = new AbortController();
    sink.append.mockImplementation(async () => { if (mode === "cancel") controller.abort(); else throw new Error("disk full"); });
    const sequences: string[] = [];
    await expect(rasterizeCompositions(plan, { sink, sequences, signal: controller.signal })).rejects.toThrow();
    expect(sequences).toEqual(["react-sequence"]);
    expect(sink.append).toHaveBeenCalledOnce();
    expect(document.querySelector(".effect-overlay")).toBeNull();
  });
});
