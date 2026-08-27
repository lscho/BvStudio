import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/AssetPanel";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

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
});
