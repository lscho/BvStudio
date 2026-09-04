import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/AssetPanel";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { BUILTIN_EFFECTS } from "@/domain/effects";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";

describe("AssetPanel video audio actions", () => {
  it("previews and manually adds a built-in sound effect", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    const onPreviewBuiltinSound = vi.fn();
    const onAddBuiltinSound = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} onPreviewBuiltinSound={onPreviewBuiltinSound} onAddBuiltinSound={onAddBuiltinSound} />);

    const soundsTab = screen.getByRole("tab", { name: "音效" });
    fireEvent.mouseDown(soundsTab, { button: 0, ctrlKey: false });
    fireEvent.click(soundsTab);
    expect(screen.getByText("丝滑转场")).toBeInTheDocument();
    expect(screen.getByText("片头冲击")).toBeInTheDocument();
    expect(screen.getByText("字幕弹出")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "试听 字幕弹出" }));
    fireEvent.click(screen.getByRole("button", { name: "添加 字幕弹出" }));
    expect(onPreviewBuiltinSound).toHaveBeenCalledWith("clean-click");
    expect(onAddBuiltinSound).toHaveBeenCalledWith("clean-click");
  });

  it("offers cloud subtitle extraction, aligned audio separation and audio export", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "video", name: "source.mp4", kind: "video", durationUs: 5_000_000, sourcePath: "/source.mp4", hasAudio: true, missing: false });
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    const onTranscribe = vi.fn();
    const onExtractAudio = vi.fn();
    const onExportAudio = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={onTranscribe} onExtractAudio={onExtractAudio} onExportAudio={onExportAudio} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "媒体" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "-1");
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
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    for (const category of ["场景", "标题", "强调", "卡片", "标注", "数据", "布局"]) {
      expect(screen.getByText(category, { selector: "summary span" })).toBeInTheDocument();
    }
    expect(container.querySelectorAll(".effect-group")).toHaveLength(7);
    const dataGroup = screen.getByText("数据", { selector: "summary span" }).closest("details");
    expect(dataGroup).toHaveTextContent("数字结论");
    expect(dataGroup).toHaveTextContent("横向数据对比");
    expect(dataGroup).toHaveTextContent("重点占比");
    expect(dataGroup).toHaveTextContent("趋势变化");
    expect(dataGroup?.querySelectorAll(".chart-swatch")).toHaveLength(4);
    expect(container.querySelectorAll(".effect-swatch")).toHaveLength(BUILTIN_EFFECTS.length);
    expect(container.querySelectorAll(".effect-swatch i")).toHaveLength(BUILTIN_EFFECTS.length);
  });

  it("selects one project accent color for new effects with undo support", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "天蓝" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "青绿" }));
    expect(useEditorStore.getState().project.motionTheme.colors).toMatchObject({
      data: "#47d7ac",
      opinion: "#47d7ac",
      warning: "#47d7ac",
      auxiliary: "#47d7ac"
    });

    fireEvent.click(screen.getByText("开场 · 高亮条").closest("button")!);
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "effect")!.clips[0]).toMatchObject({
      accentColor: "#47d7ac",
      colorRole: "auxiliary"
    });
    useEditorStore.getState().undo();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.motionTheme.colors.opinion).toBe("#5fa8ff");
  });

  it("filters the production effect library by name, description and tags", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    const effectsTab = screen.getByRole("tab", { name: "动效" });
    fireEvent.mouseDown(effectsTab, { button: 0, ctrlKey: false });
    fireEvent.click(effectsTab);
    const search = screen.getByRole("searchbox", { name: "搜索动效" });
    fireEvent.change(search, { target: { value: "风险" } });

    expect(screen.getByText("警示 · 侧栏卡")).toBeInTheDocument();
    expect(screen.queryByText("开场 · 高亮条")).not.toBeInTheDocument();
    expect(screen.getByText(/个匹配/)).toBeInTheDocument();
  });

  it("lists timed subtitles in chronological order and synchronizes selection and playhead", () => {
    const project = createEmptyProject();
    const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
    subtitleTrack.clips.push(
      { id: "later", trackId: subtitleTrack.id, kind: "subtitle", label: "第二条字幕", startUs: 3_000_000, durationUs: 1_500_000, locked: false, text: "第二条字幕。", color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 },
      { id: "first", trackId: subtitleTrack.id, kind: "subtitle", label: "第一条字幕", startUs: 500_000, durationUs: 1_000_000, locked: false, text: "第一条字幕", color: "#fff", backgroundColor: "#000", fontSize: 44, positionY: 88 }
    );
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    const onMatchEffects = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={onMatchEffects} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    const subtitleTab = screen.getByRole("tab", { name: "字幕" });
    fireEvent.mouseDown(subtitleTab, { button: 0, ctrlKey: false });
    fireEvent.click(subtitleTab);
    const entries = screen.getAllByRole("button", { name: /定位字幕/ });
    expect(entries.map((entry) => entry.textContent)).toEqual([expect.stringContaining("第一条字幕"), expect.stringContaining("第二条字幕")]);
    expect(entries[1].querySelector("p")).toHaveTextContent("第二条字幕");
    expect(entries[1].querySelector("p")).not.toHaveTextContent("第二条字幕。");
    expect(subtitleTrack.clips.find((clip) => clip.id === "later")).toMatchObject({ text: "第二条字幕。" });
    expect(screen.getByText("00:00.500 → 00:01.500")).toBeInTheDocument();
    fireEvent.click(entries[1]);
    expect(useEditorStore.getState()).toMatchObject({ selectedClipId: "later", selectedClipIds: ["later"], playheadUs: 3_000_000 });
    expect(entries[1]).toHaveClass("active");
    fireEvent.click(entries[0], { shiftKey: true });
    expect(useEditorStore.getState().selectedClipIds).toEqual(["first", "later"]);
    expect(entries[0]).toHaveClass("selected");
    expect(entries[1]).toHaveClass("selected");
    act(() => useEditorStore.getState().setPlayhead(800_000));
    expect(entries[0]).toHaveClass("active");
    expect(entries[1]).not.toHaveClass("active");
    const subtitleLibrary = document.querySelector(".subtitle-library");
    const subtitleActions = document.querySelector(".subtitle-actions");
    expect(subtitleActions).toHaveTextContent("生成匹配配音");
    expect(subtitleActions?.previousElementSibling).toBe(subtitleLibrary);
    fireEvent.click(screen.getByRole("button", { name: "匹配" }));
    expect(onMatchEffects).toHaveBeenCalledOnce();
  });

  it("opens global subtitle appearance settings from the subtitle header", () => {
    const project = createEmptyProject();
    const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
    subtitleTrack.clips.push(
      { id: "one", trackId: subtitleTrack.id, kind: "subtitle", label: "第一条", startUs: 0, durationUs: 1_000_000, locked: false, text: "第一条核心", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["核心"] },
      { id: "two", trackId: subtitleTrack.id, kind: "subtitle", label: "第二条", startUs: 1_000_000, durationUs: 1_000_000, locked: false, text: "第二条重点", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88, highlightWords: ["重点"] }
    );
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    const subtitleTab = screen.getByRole("tab", { name: "字幕" });
    fireEvent.mouseDown(subtitleTab, { button: 0, ctrlKey: false });
    fireEvent.click(subtitleTab);
    fireEvent.click(screen.getByRole("button", { name: "设置全局字幕样式" }));
    expect(screen.getByRole("dialog", { name: "全局字幕样式" })).toBeInTheDocument();
    const fontSize = screen.getByRole("slider", { name: "字号" });
    fireEvent.change(fontSize, { target: { value: "60" } });
    expect(fontSize).toHaveValue("60");
    fireEvent.click(screen.getByRole("button", { name: "应用到全部字幕" }));
    expect(screen.queryByRole("dialog", { name: "全局字幕样式" })).not.toBeInTheDocument();

    const subtitles = useEditorStore.getState().project.tracks.find((track) => track.kind === "subtitle")!.clips;
    expect(subtitles.map((clip) => clip.kind === "subtitle" ? [clip.fontSize, clip.text, clip.highlightWords] : [])).toEqual([
      [60, "第一条核心", ["核心"]],
      [60, "第二条重点", ["重点"]]
    ]);
  });
});
