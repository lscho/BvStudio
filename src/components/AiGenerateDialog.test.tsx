import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiGenerateDialog } from "@/components/AiGenerateDialog";
import { cameraMotionForPreset } from "@/domain/camera";
import { createEmptyProject } from "@/domain/project";
import { generateScriptCopy } from "@/services/ai/provider";
import { DEFAULT_SETTINGS } from "@/services/storage";
import { useEditorStore } from "@/stores/editorStore";

const emptyUsage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };

vi.mock("@/services/ai/provider", () => ({
  browserApiKey: vi.fn(() => "test-key"),
  generateScriptCopy: vi.fn(),
  getAiSessionUsage: vi.fn(() => emptyUsage),
  hasApiKey: vi.fn(async () => true),
  subscribeAiSessionUsage: vi.fn(() => () => undefined)
}));

const settings = { ...DEFAULT_SETTINGS, aiProvider: { ...DEFAULT_SETTINGS.aiProvider, model: "test-model" } };

beforeEach(() => {
  vi.clearAllMocks();
  useEditorStore.setState({
    project: createEmptyProject(),
    selectedClipId: null,
    selectedClipIds: [],
    playheadUs: 0,
    zoom: 1,
    rangeStartUs: null,
    rangeEndUs: null,
    past: [],
    future: [],
    clipboard: []
  });
});

describe("AiGenerateDialog", () => {
  it("keeps AI copy generation separate from caption creation", async () => {
    vi.mocked(generateScriptCopy).mockResolvedValueOnce({
      script: { title: "充电桩市场", article: "完整文章", narration: "第一句。第二句。" },
      usage: emptyUsage
    });
    const onOpenChange = vi.fn();
    render(<AiGenerateDialog open settings={settings} onOpenChange={onOpenChange} onNeedSettings={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "主题与要求" }), { target: { value: "介绍充电桩市场" } });
    fireEvent.click(screen.getByRole("button", { name: "生成文案" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "字幕文案" })).toHaveValue("第一句。第二句。"));
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "从文案生成字幕" }));
    const subtitles = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle");
    expect(subtitles).toHaveLength(2);
    expect(subtitles.map((clip) => clip.kind === "subtitle" ? clip.text : "")).toEqual(["第一句。", "第二句。"]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports manual copy and uses the selected range without changing video", () => {
    const project = createEmptyProject();
    const videoTrack = project.tracks.find((track) => track.kind === "video")!;
    videoTrack.clips.push({ id: "video", trackId: videoTrack.id, kind: "video", label: "原视频", startUs: 0, durationUs: 20_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "contain", camera: cameraMotionForPreset("none") });
    useEditorStore.setState({ ...useEditorStore.getState(), project, rangeStartUs: 5_000_000, rangeEndUs: 15_000_000 });
    render(<AiGenerateDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "手动输入" }));
    fireEvent.change(screen.getByRole("textbox", { name: "字幕文案" }), { target: { value: "手动输入第一句。手动输入第二句。" } });
    expect(screen.getByRole("spinbutton", { name: "目标时长" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "从文案生成字幕" }));

    const clips = useEditorStore.getState().project.tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === "video")).toMatchObject({ startUs: 0, durationUs: 20_000_000 });
    const subtitles = clips.filter((clip) => clip.kind === "subtitle");
    expect(subtitles[0]).toMatchObject({ startUs: 5_000_000 });
    const lastSubtitle = subtitles.at(-1)!;
    expect(lastSubtitle.startUs + lastSubtitle.durationUs).toBe(15_000_000);
  });

  it("imports a valid SRT with its original timecodes", async () => {
    render(<AiGenerateDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "导入 SRT" }), { button: 0, ctrlKey: false });
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["1\n00:00:01,000 --> 00:00:02,500\n第一条\n\n2\n00:00:03,000 --> 00:00:05,000\n第二条"], "captions.srt", { type: "application/x-subrip" });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("已读取 2 条字幕")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "导入字幕" }));
    const subtitles = useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "subtitle");
    expect(subtitles).toHaveLength(2);
    expect(subtitles[0]).toMatchObject({ startUs: 1_000_000, durationUs: 1_500_000 });
    expect(subtitles[1]).toMatchObject({ startUs: 3_000_000, durationUs: 2_000_000 });
    expect(useEditorStore.getState().project.tracks.flatMap((track) => track.clips).filter((clip) => clip.kind === "generated")).toHaveLength(0);
  });

  it("shows persistent progress and allows stopping AI copy generation", async () => {
    vi.mocked(generateScriptCopy).mockImplementationOnce((...args) => {
      const onProgress = args[4];
      onProgress?.({ phase: "receiving", message: "正在接收文案 · 2 KB", receivedCharacters: 2_048 });
      return new Promise(() => undefined);
    });
    render(<AiGenerateDialog open settings={settings} onOpenChange={vi.fn()} onNeedSettings={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "主题与要求" }), { target: { value: "介绍充电桩市场" } });
    fireEvent.click(screen.getByRole("button", { name: "生成文案" }));

    expect(await screen.findByRole("status")).toHaveTextContent("正在接收文案 · 2 KB");
    expect(screen.getByRole("textbox", { name: "主题与要求" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止生成" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "从文案生成字幕" })).toBeDisabled();
  });
});
