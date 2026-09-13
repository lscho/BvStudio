import { afterEach, describe, expect, it, vi } from "vitest";
import { toPng } from "html-to-image";
import { normalizeCompositionExportError, rasterizeCompositions, resolveCompositionImageUrls, waitForRenderImages } from "@/compositions/exportRenderer";
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
  it("waits for newly mounted images to decode before rasterizing the frame", async () => {
    const host = document.createElement("div");
    const image = document.createElement("img");
    const decode = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(image, "complete", { configurable: true, value: false });
    Object.defineProperty(image, "decode", { configurable: true, value: decode });
    host.append(image);

    await waitForRenderImages(host);

    expect(decode).toHaveBeenCalledOnce();
  });

  it("inlines local image sources once while preserving video URLs", async () => {
    const loadImage = vi.fn(async (path: string) => `data:image/png;base64,${path}`);
    const cache = new Map<string, Promise<string>>();
    const sources = [
      { id: "image-a", kind: "image" as const, path: "/素材/界面.png", width: 1920, height: 1080 },
      { id: "image-b", kind: "image" as const, path: "/素材/界面.png", width: 1920, height: 1080 },
      { id: "video-a", kind: "video" as const, path: "/素材/演示.mp4", width: 1920, height: 1080 }
    ];

    const urls = await resolveCompositionImageUrls(sources, undefined, cache, loadImage, (path) => `asset:${path}`);

    expect(loadImage).toHaveBeenCalledOnce();
    expect(urls.get("image-a")).toBe("data:image/png;base64,/素材/界面.png");
    expect(urls.get("image-b")).toBe("data:image/png;base64,/素材/界面.png");
    expect(urls.get("video-a")).toBe("asset:/素材/演示.mp4");
  });

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
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(vi.mocked(toPng).mock.calls.length);
  });

  it("writes only the changing frames and lets native export extend the final image", async () => {
    const { plan, sink } = setup();
    plan.overlays[0] = { ...plan.overlays[0], compositionId: "test-title-slide", durationUs: 2_000_000, speed: 1,
      recipe: { ...plan.overlays[0].recipe, entrance: "fade-up" } };
    vi.mocked(toPng).mockClear();
    const result = await rasterizeCompositions(plan, { sink, sequences: [] });
    expect(sink.append).toHaveBeenCalledTimes(15);
    expect(sink.append).toHaveBeenLastCalledWith("react-sequence", 14, "frame");
    expect(vi.mocked(toPng)).toHaveBeenCalledTimes(15);
    expect(result.overlays[0]).toMatchObject({ sequenceFrameCount: 15 });
  });

  it("turns raw browser media events into an actionable export error", () => {
    expect(normalizeCompositionExportError(new Event("error")).message).toBe("动效中的图片或视频无法加载，请检查素材是否丢失或格式不受支持");
    const original = new Error("disk full");
    expect(normalizeCompositionExportError(original)).toBe(original);
    expect(normalizeCompositionExportError("无法写入导出文件").message).toBe("无法写入导出文件");
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
