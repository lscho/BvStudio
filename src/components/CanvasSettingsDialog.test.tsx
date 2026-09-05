import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasSettingsDialog } from "@/components/CanvasSettingsDialog";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

beforeEach(() => {
  const project = createEmptyProject();
  project.assets.push({ id: "portrait", name: "portrait.mp4", kind: "video", durationUs: 5_000_000, width: 576, height: 1280, fpsNumerator: 30, fpsDenominator: 1 });
  useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, rangeStartUs: null, rangeEndUs: null, past: [], future: [], clipboard: [] });
});

describe("CanvasSettingsDialog", () => {
  it("applies a portrait output preset to the project", () => {
    const project = useEditorStore.getState().project;
    const onOpenChange = vi.fn();
    render(<CanvasSettingsDialog open onOpenChange={onOpenChange} canvas={project.canvas} assets={project.assets} />);
    fireEvent.click(screen.getByText("竖屏 9:16").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "应用画布" }));
    expect(useEditorStore.getState().project.canvas).toEqual({ width: 1080, height: 1920, fpsNumerator: 30_000, fpsDenominator: 1_000 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("can follow an imported video's exact dimensions", () => {
    const project = useEditorStore.getState().project;
    render(<CanvasSettingsDialog open onOpenChange={vi.fn()} canvas={project.canvas} assets={project.assets} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "跟随素材" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "portrait.mp4 · 576 × 1280" }));
    fireEvent.click(screen.getByRole("button", { name: "应用画布" }));
    expect(useEditorStore.getState().project.canvas).toMatchObject({ width: 576, height: 1280 });
  });

  it("only offers 30 and 60 fps and normalizes a legacy frame rate", () => {
    const project = useEditorStore.getState().project;
    project.canvas = { ...project.canvas, fpsNumerator: 24, fpsDenominator: 1 };
    render(<CanvasSettingsDialog open onOpenChange={vi.fn()} canvas={project.canvas} assets={project.assets} />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "帧率" }), { key: "Enter" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["30 fps", "60 fps"]);
    fireEvent.click(screen.getByRole("option", { name: "60 fps" }));
    fireEvent.click(screen.getByRole("button", { name: "应用画布" }));

    expect(useEditorStore.getState().project.canvas).toMatchObject({ fpsNumerator: 60_000, fpsDenominator: 1_000 });
  });

  it("applies a theme palette and keeps every semantic color individually editable", () => {
    const project = useEditorStore.getState().project;
    render(<CanvasSettingsDialog open onOpenChange={vi.fn()} canvas={project.canvas} assets={project.assets} />);

    fireEvent.click(screen.getByRole("button", { name: /浅色主题/ }));
    fireEvent.change(screen.getByLabelText("动效观点颜色"), { target: { value: "#3456d1" } });
    fireEvent.click(screen.getByRole("button", { name: "应用画布" }));

    expect(useEditorStore.getState().project.motionTheme).toMatchObject({
      skin: "light",
      colors: { text: "#1b1d21", surface: "#f7f8fa", data: "#2563eb", opinion: "#3456d1", warning: "#2563eb", auxiliary: "#2563eb" }
    });
  });

  it("updates the presenter safe area used by automatic motion layout", () => {
    const project = useEditorStore.getState().project;
    render(<CanvasSettingsDialog open onOpenChange={vi.fn()} canvas={project.canvas} assets={project.assets} />);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "人物位置" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "人物在右侧" }));
    fireEvent.change(screen.getByRole("slider", { name: "人物区域宽度" }), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "应用画布" }));

    expect(useEditorStore.getState().project.presenterSafeArea).toEqual({ position: "right", widthPercent: 40 });
  });
});
