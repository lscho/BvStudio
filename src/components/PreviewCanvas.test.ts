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
