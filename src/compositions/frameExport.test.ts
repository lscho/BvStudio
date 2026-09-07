import { afterEach, describe, expect, it, vi } from "vitest";
import { streamCompositionFrames } from "@/compositions/frameExport";
import { createMediaCompositionRenderer } from "@/compositions/threeRenderer";
import { buildRenderPlan } from "@/domain/renderPlan";
import { createEmptyProject } from "@/domain/project";
import type { RenderTextOverlay } from "@/services/media";

vi.mock("@/compositions/threeRenderer", () => ({ createMediaCompositionRenderer: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (path: string) => `asset:${path}` }));
const overlay: RenderTextOverlay = {
  kind: "composition", renderer: "three", compositionId: "poster-wall-3d", compositionImages: [{ id: "a", path: "/a.png" }],
  text: "", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, startUs: 0, durationUs: 100_000,
  sourceOffsetUs: 1_000_000, animationDurationUs: 10_000_000, speed: 2, x: 50, y: 50, opacity: 0.6,
  scale: 1, rotation: 0, zIndex: 220, recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
};
afterEach(() => vi.restoreAllMocks());

function setup() {
  const render = vi.fn();
  const dispose = vi.fn();
  vi.mocked(createMediaCompositionRenderer).mockResolvedValue({ canvas: document.createElement("canvas"), render, dispose });
  const context = { clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,frame");
  const sink = { begin: vi.fn().mockResolvedValue("sequence"), append: vi.fn().mockResolvedValue(undefined), release: vi.fn().mockResolvedValue(undefined) };
  const plan = { ...buildRenderPlan(createEmptyProject(), "/output.mp4"), fps: 30 };
  return { render, dispose, context, sink, plan };
}

describe("composition frame streaming", () => {
  it("bakes whole-scene transforms at local keyframe time and resets the downstream transform", async () => {
    const { context, sink, plan } = setup();
    const transformed = { ...overlay, x: 25, y: 70, scale: 0.5, rotation: 90, transformKeyframes: [
      { offsetUs: 0, x: 25, y: 70, scale: 0.5, easing: "linear" as const },
      { offsetUs: 100_000, x: 55, y: 40, scale: 0.8, easing: "linear" as const }
    ] };
    const result = await streamCompositionFrames(transformed, plan, { sink, sequences: [] });
    expect(context.translate.mock.calls[0]).toEqual([plan.width * 0.25, plan.height * 0.7]);
    expect(context.translate.mock.calls[1][0]).toBeCloseTo(plan.width * 0.349999);
    expect(context.scale.mock.calls[0]).toEqual([0.5, 0.5]);
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), -plan.width / 2, -plan.height / 2);
    expect(context.save).toHaveBeenCalledTimes(3);
    expect(context.restore).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 });
    expect(result.transformKeyframes).toBeUndefined();
  });
  it("waits for each decoded video frame before drawing or writing it", async () => {
    const { render, sink, plan } = setup();
    const sequence: string[] = [];
    const prepareFrame = vi.fn(async () => { sequence.push("prepare"); await Promise.resolve(); sequence.push("decoded"); });
    render.mockImplementation(() => sequence.push("render"));
    sink.append.mockImplementation(async () => { sequence.push("write"); });
    vi.mocked(createMediaCompositionRenderer).mockResolvedValue({ canvas: document.createElement("canvas"), render, prepareFrame, dispose: vi.fn() });
    await streamCompositionFrames({ ...overlay, renderer: "canvas", compositionId: "motion-zoom" }, plan, { sink, sequences: [] });
    expect(sequence).toEqual(Array.from({ length: 3 }, () => ["prepare", "decoded", "render", "write"]).flat());
  });
  it("writes ordered frames at source time without retaining base64 arrays", async () => {
    const { render, dispose, context, sink, plan } = setup();
    const sequences: string[] = [];
    const result = await streamCompositionFrames(overlay, plan, { sink, sequences });
    expect(sink.append.mock.calls).toEqual([["sequence", 0, "frame"], ["sequence", 1, "frame"], ["sequence", 2, "frame"]]);
    expect(render.mock.calls).toEqual([[1_000_000, 10_000_000], [1_066_666, 10_000_000], [1_133_334, 10_000_000]]);
    expect(context.globalAlpha).toBe(0.6);
    expect(result).toMatchObject({ sequenceId: "sequence", sequenceFps: 30, speed: 1, opacity: 1 });
    expect(result.sequenceFramesBase64).toBeUndefined();
    expect(sequences).toEqual(["sequence"]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("stops on cancellation and leaves the cache ID available for caller cleanup", async () => {
    const { dispose, sink, plan } = setup();
    const controller = new AbortController();
    const sequences: string[] = [];
    sink.append.mockImplementation(async () => { controller.abort(); });
    await expect(streamCompositionFrames(overlay, plan, { sink, sequences, signal: controller.signal })).rejects.toThrow();
    expect(sink.append).toHaveBeenCalledOnce();
    expect(sequences).toEqual(["sequence"]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("disposes the renderer when disk writes fail", async () => {
    const { dispose, sink, plan } = setup();
    sink.append.mockRejectedValue(new Error("disk full"));
    await expect(streamCompositionFrames(overlay, plan, { sink, sequences: [] })).rejects.toThrow("disk full");
    expect(dispose).toHaveBeenCalledOnce();
  });
});
