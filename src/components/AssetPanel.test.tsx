import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/AssetPanel";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";

describe("AssetPanel video audio actions", () => {
  it("offers local subtitle extraction, aligned audio separation and audio export", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "source.mp4", kind: "video", durationUs: 5_000_000, sourcePath: "/source.mp4", hasAudio: true, missing: false });
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    const onTranscribe = vi.fn();
    const onExtractAudio = vi.fn();
    const onExportAudio = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onTranscribe={onTranscribe} onExtractAudio={onExtractAudio} onExportAudio={onExportAudio} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "媒体" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "提取 source.mp4 的字幕" }));
    fireEvent.click(screen.getByRole("button", { name: "分离 source.mp4 的音频到音轨" }));
    fireEvent.click(screen.getByRole("button", { name: "导出 source.mp4 的音频" }));
    expect(onTranscribe).toHaveBeenCalledWith("video");
    expect(onExtractAudio).toHaveBeenCalledWith("video");
    expect(onExportAudio).toHaveBeenCalledWith("video");
  });

  it("groups the complete effect library and renders a recipe thumbnail for every effect", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    for (const category of ["标题", "强调", "卡片", "标注", "布局", "场景"]) {
      expect(screen.getByText(category, { selector: "summary span" })).toBeInTheDocument();
    }
    expect(container.querySelectorAll(".effect-group")).toHaveLength(6);
    expect(container.querySelectorAll(".effect-swatch")).toHaveLength(BUILTIN_EFFECTS.length);
    expect(container.querySelectorAll(".effect-swatch i")).toHaveLength(BUILTIN_EFFECTS.length);
  });
});
