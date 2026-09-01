import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterProgressDialog } from "@/components/ChapterProgressDialog";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";

beforeEach(() => {
  const project = createEmptyProject();
  const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
  track.clips.push(
    { id: "one", trackId: track.id, kind: "subtitle", label: "导入素材", startUs: 0, durationUs: 2_000_000, locked: false, text: "先导入并整理素材", color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 },
    { id: "two", trackId: track.id, kind: "subtitle", label: "完成导出", startUs: 2_000_000, durationUs: 3_000_000, locked: false, text: "最后检查并完成导出", color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 }
  );
  useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, rangeStartUs: null, rangeEndUs: null, past: [], future: [], clipboard: [], focusPickClipId: null, previewRequest: null });
});

describe("ChapterProgressDialog", () => {
  it("creates editable chapters from timed subtitles and saves with undo support", () => {
    const onOpenChange = vi.fn();
    render(<ChapterProgressDialog open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "章节数量" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "按字幕分段" }));
    fireEvent.change(screen.getByRole("textbox", { name: "章节 1 标题" }), { target: { value: "准备" } });
    fireEvent.submit(screen.getByRole("button", { name: "应用" }).closest("form")!);

    expect(useEditorStore.getState().project.chapterProgress).toMatchObject({ enabled: true, chapters: [{ title: "准备", startUs: 0 }, { startUs: 2_000_000 }] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.chapterProgress.enabled).toBe(false);
  });
});
