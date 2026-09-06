import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewCanvas, moveEffectTransform, previewAudioGain, previewNativeAudioVolume, resizeEffectTransform, videoTargetPoint } from "@/components/PreviewCanvas";
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
  it("opens presenter settings from the toolbar when avoidance is not configured", () => {
    render(createElement(PreviewCanvas, { aiProvider, onNeedSettings: vi.fn(), onImport: vi.fn(), onGenerate: vi.fn(), playing: false }));

    const presenterButton = screen.getByRole("button", { name: "设置人物避让区" });
    expect(presenterButton).toBeEnabled();
    fireEvent.click(presenterButton);
    expect(screen.getByRole("heading", { name: "画布与动效主题" })).toBeVisible();
  });

  it("moves an effect in canvas-relative percentages", () => {
    expect(moveEffectTransform(transform, 100, -50, 1000, 500)).toMatchObject({ x: 60, y: 40, scale: 1 });
  });

  it("resizes from every edge and clamps the supported scale", () => {
    expect(resizeEffectTransform(transform, "e", 100, 0, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "nw", -100, -50, 1000, 500).scale).toBeCloseTo(1.3);
    expect(resizeEffectTransform(transform, "se", 10_000, 10_000, 1000, 500).scale).toBe(3);
    expect(resizeEffectTransform(transform, "se", -10_000, -10_000, 1000, 500).scale).toBe(0.3);
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
