import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChapterProgressDialog } from "@/components/ChapterProgressDialog";
import { createEmptyProject } from "@/domain/project";
import type { AiProviderConfig } from "@/services/ai/provider";
import { useEditorStore } from "@/stores/editorStore";

const { generateSubtitleChapters } = vi.hoisted(() => ({
  generateSubtitleChapters: vi.fn(async () => ({
    chapters: [{ captionIndex: 0, title: "准备素材" }, { captionIndex: 1, title: "完成导出" }],
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCostUsd: 0 }
  }))
}));

vi.mock("@/services/ai/provider", () => ({
  browserApiKey: vi.fn(() => "test-key"),
  generateSubtitleChapters,
  hasApiKey: vi.fn(async () => true)
}));

const aiProvider: AiProviderConfig = {
  protocol: "openai-chat",
  baseUrl: "https://models.example.com",
  model: "test-model",
  inputCostPerMillion: 0,
  outputCostPerMillion: 0
};

beforeEach(() => {
  generateSubtitleChapters.mockClear();
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
    render(<ChapterProgressDialog open aiProvider={aiProvider} onOpenChange={onOpenChange} onNeedSettings={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "章节数量" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "按字幕分段" }));
    fireEvent.change(screen.getByRole("textbox", { name: "章节 1 标题" }), { target: { value: "准备" } });
    fireEvent.submit(screen.getByRole("button", { name: "应用" }).closest("form")!);

    expect(useEditorStore.getState().project.chapterProgress).toMatchObject({ enabled: true, chapters: [{ title: "准备", startUs: 0 }, { startUs: 2_000_000 }] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.chapterProgress.enabled).toBe(false);
  });

  it("applies a preset and switches to custom after appearance edits", () => {
    render(<ChapterProgressDialog open aiProvider={aiProvider} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "底部浅色分段" }));
    expect(screen.getByRole("combobox", { name: "显示位置" })).toHaveValue("bottom");
    expect(screen.getByRole("combobox", { name: "进度样式" })).toHaveValue("segments");

    fireEvent.change(screen.getByRole("combobox", { name: "进度样式" }), { target: { value: "steps" } });
    expect(screen.getByText("当前：自定义")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "显示章节标题" }));
    fireEvent.submit(screen.getByRole("button", { name: "应用" }).closest("form")!);

    expect(useEditorStore.getState().project.chapterProgress).toMatchObject({
      enabled: true,
      preset: "custom",
      position: "bottom",
      style: "steps",
      showTitles: false
    });
  });

  it("creates chapters from AI-selected subtitle boundaries", async () => {
    render(<ChapterProgressDialog open aiProvider={aiProvider} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "AI 智能分章" }));

    await waitFor(() => expect(generateSubtitleChapters).toHaveBeenCalledWith(
      aiProvider,
      expect.objectContaining({
        requestedCount: 4,
        captions: [
          { startSeconds: 0, endSeconds: 2, text: "先导入并整理素材" },
          { startSeconds: 2, endSeconds: 5, text: "最后检查并完成导出" }
        ]
      }),
      "test-key",
      expect.any(AbortSignal),
      expect.any(Function)
    ));
    expect(screen.getByRole("textbox", { name: "章节 1 标题" })).toHaveValue("准备素材");
    expect(screen.getByRole("spinbutton", { name: "章节 2 开始时间" })).toHaveValue(2);
  });

  it("directs users to model settings when AI is not configured", () => {
    const onOpenChange = vi.fn();
    const onNeedSettings = vi.fn();
    render(<ChapterProgressDialog open aiProvider={{ ...aiProvider, model: "" }} onOpenChange={onOpenChange} onNeedSettings={onNeedSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "AI 智能分章" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请先配置云端模型和 API Key");
    fireEvent.click(screen.getByRole("button", { name: "打开配置" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNeedSettings).toHaveBeenCalledOnce();
  });
});
