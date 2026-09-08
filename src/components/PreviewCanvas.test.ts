import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewCanvas, anchorContentResizeTransform, interactionBoundsFromScreenPoints, moveEffectTransform, previewAudioGain, previewCanvasLength, previewNativeAudioVolume, resizeEffectTransform, videoTargetPoint } from "@/components/PreviewCanvas";
import { createEmptyProject } from "@/domain/project";
import type { AiProviderConfig } from "@/services/ai/provider";
import { useEditorStore } from "@/stores/editorStore";

const transform = { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
const aiProvider: AiProviderConfig = { protocol: "openai-chat", baseUrl: "https://models.example.com", model: "test", inputCostPerMillion: 0, outputCostPerMillion: 0 };

beforeEach(() => {
  useEditorStore.setState({
    project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1,
    rangeStartUs: null, rangeEndUs: null, past: [], future: [], clipboard: [], focusPickClipId: null, previewRequest: null
  });
});

describe("PreviewCanvas effect manipulation", () => {
  it("places background library previews below a cropped video and timeline foreground graphics", () => {
    useEditorStore.getState().addVideo({ id: "portrait", name: "portrait.mp4", kind: "video", durationUs: 8_000_000, objectUrl: "blob:portrait" });
    const id = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateVideo(id, { fit: "cover", mask: { shape: "rectangle", radius: 0, feather: 0, borderWidth: 0, borderColor: "#ffffff", focusX: 65, focusY: 50, widthPercent: 25, heightPercent: 80 } });
    useEditorStore.getState().addComposition("punch-pill");
    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false, effectPreview: { compositionId: "background-grid", requestId: 1 } }));
    expect(container.querySelector(".effect-preview-composition")).toHaveStyle({ zIndex: 0 });
    expect(container.querySelector(".video-layer")).toHaveStyle({ zIndex: 20, width: "25%", height: "80%" });
    expect(container.querySelector(".video-content video")).toHaveStyle({ objectFit: "cover", objectPosition: "65% 50%" });
    expect(container.querySelector(".component-punch-pill")).toHaveStyle({ zIndex: 220 });
  });

  it("previews contained video framing and disables canvas handles on locked tracks", () => {
    useEditorStore.getState().addVideo({ id: "portrait", name: "portrait.mp4", kind: "video", width: 1080, height: 1920, durationUs: 8_000_000, objectUrl: "blob:portrait" });
    const id = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateCanvas({ ...useEditorStore.getState().project.canvas, width: 1920, height: 1080 });
    useEditorStore.getState().updateVideo(id, { transform: { ...transform, scale: 0.6 }, mask: { shape: "rectangle", radius: 0, feather: 0, borderWidth: 0, borderColor: "#ffffff", focusX: 50, focusY: 50, widthPercent: 80, heightPercent: 25 } });
    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    expect(container.querySelector(".video-content video")).toHaveStyle({ objectFit: "contain" });
    expect(container.querySelector(".video-layer")).toHaveStyle({ width: "31.640625%", height: "100%" });
    expect(container.querySelector(".video-layer")?.getAttribute("style")).toContain("scale(0.6)");
    expect(container.querySelectorAll(".video-layer .canvas-resize-handle")).toHaveLength(8);
    const track = useEditorStore.getState().project.tracks.find((candidate) => candidate.clips.some((clip) => clip.id === id))!;
    act(() => useEditorStore.getState().setTrackState(track.id, { locked: true }));
    expect(container.querySelectorAll(".video-layer .canvas-resize-handle")).toHaveLength(0);
  });

  it("positions material compositions and hides resize handles when locked", () => {
    useEditorStore.getState().addComposition("poster-wall-3d");
    const id = useEditorStore.getState().selectedClipId!;
    useEditorStore.getState().updateComposition(id, { transform: { x: 25, y: 70, scale: 0.5, rotation: 30, opacity: 0.8 } });
    const view = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    const overlay = screen.getByRole("button", { name: "选择 3D 海报墙" }).parentElement?.parentElement;
    expect(overlay).toHaveStyle({ left: "25%", top: "70%", opacity: "0.8", transform: "translate(-50%, -50%) scale(0.5) rotate(30deg)" });
    expect(overlay?.querySelectorAll(".canvas-resize-handle")).toHaveLength(8);
    view.unmount();
    useEditorStore.getState().updateComposition(id, { locked: true });
    render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    expect(screen.getByRole("button", { name: "选择 3D 海报墙" }).parentElement?.parentElement?.querySelectorAll(".canvas-resize-handle")).toHaveLength(0);
  });

  it("renders a transient library preview without adding a timeline composition", () => {
    const onCloseEffectPreview = vi.fn();
    const { container } = render(createElement(PreviewCanvas, {
      aiProvider,
      onNeedSettings: vi.fn(),
      onImport: vi.fn(),
      onGenerate: vi.fn(),
      playing: false,
      effectPreview: { compositionId: "punch-pill", requestId: 1 },
      onCloseEffectPreview
    }));

    expect(container.querySelector(".effect-library-preview .component-punch-pill")).toHaveTextContent("一句金句，定格三秒");
    expect(container.querySelector(".effect-preview-sample-backdrop")).not.toBeInTheDocument();
    expect(screen.getByText("预览 · 金句强调条")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭动效预览" }));
    expect(onCloseEffectPreview).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(0);
  });

  it("renders a bound recording from the current project inside a reference camera effect", () => {
    useEditorStore.getState().addComposition("cam-pan");
    const clip = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).find((candidate) => candidate.kind === "composition")!;
    useEditorStore.getState().bindCompositionAssets(clip.id, [{ slotId: "recording", assetIds: ["screen"] }], [{
      id: "screen", name: "screen.mp4", kind: "video", durationUs: 8_000_000, objectUrl: "blob:screen"
    }]);

    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    expect(container.querySelector(".component-cam-pan video")).toHaveAttribute("src", "blob:screen#bvideo-video");
  });

  it("uses the rendered foreground card as the interaction bounds instead of the full canvas", () => {
    useEditorStore.getState().addComposition("pain-points");
    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));

    expect(container.querySelector(".component-pain-points")).toHaveAttribute("data-interaction-bounds", "content");
    expect(container.querySelector(".component-pain-points [data-overlay-content-root]")).toBeInTheDocument();
  });

  it("uses a neutral temporary material placeholder for a focus-card preview", () => {
    const { container } = render(createElement(PreviewCanvas, {
      aiProvider,
      onNeedSettings: vi.fn(),
      onImport: vi.fn(),
      onGenerate: vi.fn(),
      playing: false,
      effectPreview: { compositionId: "focus-card", requestId: 1 }
    }));

    expect(container.querySelector(".component-focus-card")).toBeInTheDocument();
    expect(container.querySelector(".focus-card-media-frame img")).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
    expect(useEditorStore.getState().project.assets).toEqual([]);
  });

  it("lets an active focus card take over its linked timeline video", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "presenter", name: "presenter.mp4", kind: "video", durationUs: 10_000_000, objectUrl: "blob:presenter" });
    project.tracks.find((track) => track.kind === "video")!.clips.push({
      id: "presenter-video", trackId: "video-main", kind: "video", label: "人物", startUs: 0, durationUs: 10_000_000,
      locked: false, assetId: "presenter", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover",
      camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" }
    });
    project.tracks.find((track) => track.kind === "composition")!.clips.push({
      id: "focus", trackId: "effect-main", kind: "composition", label: "人物聚焦卡", startUs: 2_000_000, durationUs: 6_000_000,
      locked: false, compositionId: "focus-card", bindings: [{ slotId: "presenter", assetIds: ["presenter"] }], text: "要点一｜要点二",
      color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }
    });
    useEditorStore.setState({ ...useEditorStore.getState(), project, playheadUs: 2_400_000 });

    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    expect(container.querySelectorAll(".video-layer")).toHaveLength(0);
    expect(container.querySelectorAll(".focus-card-linked-media")).toHaveLength(1);
  });

  it("isolates a library preview from existing timeline graphics", () => {
    useEditorStore.getState().addComposition("punch-pill");
    const project = useEditorStore.getState().project;
    project.motionTheme.skin = "light";
    useEditorStore.setState({ ...useEditorStore.getState(), project });
    const { container } = render(createElement(PreviewCanvas, {
      aiProvider,
      onNeedSettings: vi.fn(),
      onImport: vi.fn(),
      onGenerate: vi.fn(),
      playing: false,
      effectPreview: { compositionId: "punch-pill", requestId: 1 }
    }));

    expect(container.querySelectorAll(".component-punch-pill")).toHaveLength(1);
    expect(container.querySelector(".effect-preview-sample-backdrop")).not.toBeInTheDocument();
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(1);
  });

  it("uses canvas-relative effect type size without a preview-only pixel floor", () => {
    expect(previewCanvasLength(48, 1920)).toBe("2.5cqw");
    expect(previewCanvasLength(48, 1920, 10)).toBe("clamp(10px, 2.5cqw, 48px)");
  });
  it("uses one toolbar button to create and clear the presenter area with undo support", () => {
    render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));

    const presenterButton = screen.getByRole("button", { name: "设置人物避让区" });
    expect(presenterButton).toBeEnabled();
    expect(screen.queryByRole("button", { name: "清除人物避让区" })).not.toBeInTheDocument();
    expect(presenterButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(presenterButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移动人物避让区" })).toBeVisible();
    const settings = useEditorStore.getState().project.presenterSafeArea;
    expect(settings.position).not.toBe("none");
    expect(screen.getByRole("button", { name: "清除人物避让区" })).toBe(presenterButton);
    expect(presenterButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(presenterButton);
    expect(screen.queryByRole("button", { name: "移动人物避让区" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设置人物避让区" })).toBe(presenterButton);
    expect(presenterButton).toHaveAttribute("aria-pressed", "false");
    expect(useEditorStore.getState().project.presenterSafeArea.position).toBe("none");
    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual(settings);
    expect(screen.getByRole("button", { name: "移动人物避让区" })).toBeVisible();
    act(() => useEditorStore.getState().redo());
    expect(useEditorStore.getState().project.presenterSafeArea.position).toBe("none");
    fireEvent.click(presenterButton);
    expect(screen.getByRole("button", { name: "移动人物避让区" })).toBeVisible();
  });

  it("shows an existing or dismissed presenter area before offering to clear it", () => {
    const settings = { position: "custom" as const, xPercent: 18, yPercent: 12, widthPercent: 36, heightPercent: 65 };
    useEditorStore.getState().updatePresenterSafeArea(settings);
    const historyLength = useEditorStore.getState().past.length;
    render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));

    fireEvent.click(screen.getByRole("button", { name: "显示人物避让框" }));
    expect(screen.getByRole("button", { name: "清除人物避让区" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "移动人物避让区" }), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "移动人物避让区" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "显示人物避让框" }));
    expect(screen.getByRole("button", { name: "移动人物避让区" })).toBeVisible();
    expect(useEditorStore.getState().project.presenterSafeArea).toEqual(settings);
    expect(useEditorStore.getState().past).toHaveLength(historyLength);
  });

  it("hides presenter editing during playback and library previews", () => {
    const props = { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false };
    const view = render(createElement(PreviewCanvas, props));
    fireEvent.click(screen.getByRole("button", { name: "设置人物避让区" }));
    view.rerender(createElement(PreviewCanvas, { ...props, playing: true }));
    expect(screen.queryByRole("button", { name: "移动人物避让区" })).not.toBeInTheDocument();
    view.rerender(createElement(PreviewCanvas, { ...props, effectPreview: { compositionId: "punch-pill", requestId: 1 } }));
    expect(screen.queryByRole("button", { name: "移动人物避让区" })).not.toBeInTheDocument();
    view.rerender(createElement(PreviewCanvas, props));
    expect(screen.getByRole("button", { name: "移动人物避让区" })).toBeVisible();
  });

  it("moves an effect in canvas-relative percentages", () => {
    expect(moveEffectTransform(transform, 100, -50, 1000, 500)).toMatchObject({ x: 60, y: 40, scale: 1 });
  });

  it("resizes from every edge and clamps the supported scale", () => {
    expect(resizeEffectTransform(transform, "e", 100, 0, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "e", 100, 0, 400, 200, 1).scale).toBeCloseTo(1.25);
    expect(resizeEffectTransform(transform, "nw", -100, -50, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "se", 10_000, 10_000, 1000, 500).scale).toBe(3);
    expect(resizeEffectTransform(transform, "se", -10_000, -10_000, 1000, 500).scale).toBe(0.3);
  });

  it("maps a transformed screen quad back to content-local selection bounds", () => {
    expect(interactionBoundsFromScreenPoints([
      { x: 120, y: 70 }, { x: 320, y: 70 }, { x: 320, y: 170 }, { x: 120, y: 170 }
    ], { x: 20, y: 20 }, { x: 22, y: 20 }, { x: 20, y: 22 })).toEqual({ left: 50, top: 25, width: 100, height: 50 });
  });

  it("keeps the opposite content edge fixed while resizing a full-canvas effect", () => {
    const resized = resizeEffectTransform(transform, "e", 100, 0, 200, 100, 1);
    expect(anchorContentResizeTransform(transform, resized, "e",
      { left: 100, top: 100, width: 200, height: 100 },
      { left: 0, top: 0, width: 1000, height: 500 })).toMatchObject({ x: 70, y: 60, scale: 1.5 });
  });

  it("maps draggable crop and focus targets to bounded canvas percentages", () => {
    const bounds = { left: 100, top: 50, width: 400, height: 200 };
    expect(videoTargetPoint(300, 100, bounds)).toEqual({ x: 50, y: 25 });
    expect(videoTargetPoint(50, 400, bounds)).toEqual({ x: 0, y: 100 });
  });

  it("previews an image momentum transition without also playing its pop entrance", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "image", name: "badge.png", kind: "image", durationUs: 2_000_000, objectUrl: "data:image/png;base64,iVBORw0KGgo=" });
    const track = project.tracks.find((candidate) => candidate.kind === "image")!;
    track.clips.push({
      id: "image-clip", trackId: track.id, kind: "image", label: "badge", startUs: 2_000_000, durationUs: 2_000_000,
      locked: false, assetId: "image", transform: { x: 65, y: 35, scale: 0.8, rotation: 4, opacity: 0.9 }, entrance: "pop", speed: 1,
      transition: { preset: "momentum-zoom", durationUs: 500_000, easing: "ease-in-out" }
    });
    useEditorStore.setState({ ...useEditorStore.getState(), project, playheadUs: 2_250_000 });

    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    const image = container.querySelector<HTMLElement>(".image-overlay");
    expect(image?.style.transform).toContain("scale(0.76)");
    expect(image?.style.filter).toContain("blur(");
  });

  it("previews the same momentum scale on video clips", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "cut.mp4", kind: "video", durationUs: 2_000_000, objectUrl: "blob:cut-video" });
    const track = project.tracks.find((candidate) => candidate.kind === "video")!;
    track.clips.push({
      id: "video-clip", trackId: track.id, kind: "video", label: "cut", startUs: 2_000_000, durationUs: 2_000_000,
      locked: false, assetId: "video", sourceInUs: 0, playbackRate: 1, volume: 0, fit: "cover", camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" },
      transition: { preset: "momentum-zoom", durationUs: 500_000, easing: "ease-in-out" }
    });
    useEditorStore.setState({ ...useEditorStore.getState(), project, playheadUs: 2_250_000 });

    const { container } = render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));
    const video = container.querySelector<HTMLElement>(".video-layer");
    expect(video?.style.transform).toContain("scale(0.95)");
    expect(container.querySelector<HTMLElement>(".video-content video")?.style.filter).toContain("blur(");
  });
});

describe("previewAudioGain", () => {
  it("calculates the requested export-equivalent gain", () => {
    expect(previewAudioGain(1.5, 1, 1, false)).toBe(1.5);
  });

  it("caps native preview volume without muting boosted voice clips", () => {
    expect(previewNativeAudioVolume(1.5, 1, 1, false)).toBe(1);
    expect(previewNativeAudioVolume(0.65, 1, 1, false)).toBe(0.65);
  });

  it("applies fades and music ducking before preview playback", () => {
    expect(previewAudioGain(1.5, 0.5, 1, false)).toBe(0.75);
    expect(previewAudioGain(1, 1, 1, true)).toBe(0.28);
    expect(previewNativeAudioVolume(1, 0.5, 1, true)).toBe(0.14);
  });
});
