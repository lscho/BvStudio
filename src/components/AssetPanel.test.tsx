import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/AssetPanel";
import { InspectorPanel } from "@/components/InspectorPanel";
import { createEmptyProject } from "@/domain/project";
import { useEditorStore } from "@/stores/editorStore";
import { BUILTIN_EFFECTS, PREMIUM_EFFECT_IDS } from "@/domain/effects";
import { FREE_MUSIC_TRACKS, FREE_SOUNDS_PER_CATEGORY, SOUND_CATEGORY_ORDER } from "@/domain/soundAccess";
import { useEffectLibraryStore } from "@/stores/effectLibraryStore";
import { useLicenseStore } from "@/stores/licenseStore";

describe("AssetPanel video audio actions", () => {
  it("opens script records from subtitles and keeps editing undoable without a timeline row", () => {
    const project = createEmptyProject();
    project.tracks.find(t => t.kind === "generated")!.clips.push({ id: "script", trackId: "generated-main", kind: "generated", label: "第二段脚本", startUs: 10_000_000, durationUs: 3_000_000, locked: false, article: "原文章", narration: "原口播", prompt: "", insertMode: "insert", scenes: [] });
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] });
    render(<><AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} /><InspectorPanel /></>);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "字幕" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("button", { name: "编辑脚本 第二段脚本" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "脚本记录" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑脚本 第二段脚本" }));
    expect(useEditorStore.getState()).toMatchObject({ selectedClipId: "script", playheadUs: 10_000_000 });
    fireEvent.change(screen.getByRole("textbox", { name: "文章" }), { target: { value: "更新文章" } });
    expect(useEditorStore.getState().project.tracks.find(t => t.kind === "generated")!.clips[0]).toMatchObject({ article: "更新文章", narration: "原口播" });
    act(() => useEditorStore.getState().undo());
    expect(useEditorStore.getState().project.tracks.find(t => t.kind === "generated")!.clips[0]).toMatchObject({ article: "原文章" });
    act(() => useEditorStore.getState().redo());
    expect(useEditorStore.getState().project.tracks.find(t => t.kind === "generated")!.clips[0]).toMatchObject({ article: "更新文章" });
  });
  it("groups the Shotcraft audio library into 8 categories plus music and hides built-in sound effects", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useLicenseStore.setState({ status: { isVip: false, planName: "普通用户", expireAt: null, activatedAt: null, licenseKey: null } });
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    const soundsTab = screen.getByRole("tab", { name: "音效" });
    fireEvent.mouseDown(soundsTab, { button: 0, ctrlKey: false });
    fireEvent.click(soundsTab);

    for (const name of ["丝滑转场", "片头冲击", "字幕弹出"]) expect(screen.queryByText(name)).not.toBeInTheDocument();
    for (const category of SOUND_CATEGORY_ORDER) expect(screen.getByText(category, { selector: "summary span" })).toBeInTheDocument();
    expect(container.querySelectorAll(".shotcraft-audio-library .effect-group")).toHaveLength(SOUND_CATEGORY_ORDER.length);
    expect(container.querySelectorAll(".shotcraft-audio-library .effect-group[open]")).toHaveLength(0);

    const transitionGroup = screen.getByText("转场", { selector: "summary span" }).closest("details")!;
    expect(within(transitionGroup).getAllByRole("button", { name: /^添加 /, hidden: true })).toHaveLength(FREE_SOUNDS_PER_CATEGORY);
    expect(within(transitionGroup).getAllByRole("button", { name: /需要 Pro 会员$/, hidden: true }).length).toBeGreaterThan(0);

    const musicGroup = screen.getByText("音乐", { selector: "summary span" }).closest("details")!;
    expect(musicGroup).toHaveTextContent("bgm-tech-house");
    expect(within(musicGroup).getAllByRole("button", { name: /^添加 /, hidden: true })).toHaveLength(FREE_MUSIC_TRACKS);
    expect(within(musicGroup).getAllByRole("button", { name: /需要 Pro 会员$/, hidden: true })).toHaveLength(5 - FREE_MUSIC_TRACKS);
  });

  it("keeps Pro-only sounds previewable and routes the PRO button to the license dialog", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useLicenseStore.setState({ status: { isVip: false, planName: "普通用户", expireAt: null, activatedAt: null, licenseKey: null } });
    const onNeedLicense = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} onNeedLicense={onNeedLicense} />);

    const soundsTab = screen.getByRole("tab", { name: "音效" });
    fireEvent.mouseDown(soundsTab, { button: 0, ctrlKey: false });
    fireEvent.click(soundsTab);

    const transitionGroup = screen.getByText("转场", { selector: "summary span" }).closest("details")!;
    const proButtons = within(transitionGroup).getAllByRole("button", { name: /需要 Pro 会员$/, hidden: true });
    expect(proButtons.every((button) => button.textContent === "PRO")).toBe(true);
    expect(within(transitionGroup).getAllByRole("button", { name: /^试听 /, hidden: true }).length).toBeGreaterThan(FREE_SOUNDS_PER_CATEGORY);

    fireEvent.click(proButtons[0]);
    expect(onNeedLicense).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().project.assets).toHaveLength(0);
  });

  it("unlocks every sound and music track once the device holds an active Pro license", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useLicenseStore.setState({ status: { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: Date.now(), licenseKey: null } });
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    const soundsTab = screen.getByRole("tab", { name: "音效" });
    fireEvent.mouseDown(soundsTab, { button: 0, ctrlKey: false });
    fireEvent.click(soundsTab);

    expect(container.querySelectorAll(".sound-row.locked")).toHaveLength(0);
    expect(container.querySelectorAll("button.pro-locked")).toHaveLength(0);
    const musicGroup = screen.getByText("音乐", { selector: "summary span" }).closest("details")!;
    expect(within(musicGroup).getAllByRole("button", { name: /^添加 /, hidden: true })).toHaveLength(5);
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

  it("groups the migrated effect library and renders a thumbnail for every effect", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);

    for (const category of ["背景", "展示", "场景", "标题", "强调", "卡片", "标注", "数据", "布局", "高级"]) {
      expect(screen.getByText(category, { selector: "summary span" })).toBeInTheDocument();
    }
    expect(container.querySelectorAll(".effect-group")).toHaveLength(10);
    expect(container.querySelectorAll(".effect-group[open]")).toHaveLength(0);
    const dataGroup = screen.getByText("数据", { selector: "summary span" }).closest("details");
    const backgroundGroup = screen.getByText("背景", { selector: "summary span" }).closest("details");
    const displayGroup = screen.getByText("展示", { selector: "summary span" }).closest("details");
    const sceneGroup = screen.getByText("场景", { selector: "summary span" }).closest("details");
    const layoutGroup = screen.getByText("布局", { selector: "summary span" }).closest("details");
    const annotationGroup = screen.getByText("标注", { selector: "summary span" }).closest("details");
    expect(dataGroup).toHaveTextContent("数据排名条");
    expect(dataGroup).toHaveTextContent("环形指标");
    expect(dataGroup).toHaveTextContent("翻牌计数器");
    expect(dataGroup).toHaveTextContent("数字实证");
    expect(dataGroup).toHaveTextContent("增长曲线");
    expect(dataGroup).not.toHaveTextContent("数字结论");
    expect(backgroundGroup).toHaveTextContent("玻璃底幕");
    expect(backgroundGroup).toHaveTextContent("全屏毛玻璃");
    expect(annotationGroup).not.toHaveTextContent("玻璃底幕");
    expect(displayGroup).toHaveTextContent("截图实证");
    expect(displayGroup).toHaveTextContent("录屏演示运镜");
    expect(displayGroup).toHaveTextContent("静态图运镜");
    expect(displayGroup).not.toHaveTextContent("3D 海报墙");
    expect(displayGroup).not.toHaveTextContent("双图展示");
    const premiumGroup = screen.getByText("高级", { selector: "summary span" }).closest("details");
    expect(premiumGroup).toHaveTextContent("3D 海报墙");
    expect(premiumGroup).toHaveTextContent("双图展示");
    expect(sceneGroup).not.toHaveTextContent("3D 海报墙");
    expect(sceneGroup).not.toHaveTextContent("双图展示");
    expect(layoutGroup).toHaveTextContent("动作卡组");
    expect(layoutGroup).toHaveTextContent("步骤清单");
    expect(screen.getByText("章节导航条")).toBeInTheDocument();
    expect(screen.getByText("双语字幕轨")).toBeInTheDocument();
    const swatches = container.querySelectorAll(".effect-swatch");
    expect(swatches).toHaveLength(BUILTIN_EFFECTS.length);
    expect(container.querySelectorAll(".effect-swatch i > svg")).toHaveLength(BUILTIN_EFFECTS.length);
    expect([...swatches].every((swatch) => swatch.querySelector("svg"))).toBe(true);
  });

  it("previews an effect from the row and only adds it from the plus button", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    const onPreviewEffect = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} onPreviewEffect={onPreviewEffect} />);

    const previewButton = screen.getByRole("button", { name: "预览 金句强调条", hidden: true });
    fireEvent.click(previewButton);
    fireEvent.click(previewButton);
    expect(onPreviewEffect).toHaveBeenCalledTimes(2);
    expect(onPreviewEffect).toHaveBeenLastCalledWith("punch-pill");
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "添加 金句强调条 到时间线", hidden: true }));
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(1);
  });

  it("keeps premium effects previewable but replaces the add button with a locked PRO button", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    useLicenseStore.setState({ status: { isVip: false, planName: "普通用户", expireAt: null, activatedAt: null, licenseKey: null } });
    const onNeedLicense = vi.fn();
    const onPreviewEffect = vi.fn();
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} onNeedLicense={onNeedLicense} onPreviewEffect={onPreviewEffect} />);

    const premiumGroup = screen.getByText("高级", { selector: "summary span" }).closest("details")!;
    expect(container.querySelectorAll(".effect-library-item.locked").length).toBeGreaterThanOrEqual(PREMIUM_EFFECT_IDS.length);
    const proButtons = within(premiumGroup).getAllByRole("button", { name: /需要 Pro 会员$/, hidden: true });
    expect(proButtons.length).toBeGreaterThanOrEqual(PREMIUM_EFFECT_IDS.length);
    expect(proButtons.every((button) => button.textContent === "PRO")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "预览 3D 终端", hidden: true }));
    expect(onPreviewEffect).toHaveBeenCalledWith("terminal-3d");
    expect(onNeedLicense).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "3D 终端 需要 Pro 会员", hidden: true }));
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(0);
    expect(onNeedLicense).toHaveBeenCalledTimes(1);
  });

  it("unlocks every effect once the device holds an active Pro license", () => {
    const project = createEmptyProject();
    useEditorStore.setState({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, zoom: 1, past: [], future: [], clipboard: [] });
    useEffectLibraryStore.setState({ effects: [...BUILTIN_EFFECTS] });
    useLicenseStore.setState({ status: { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: Date.now(), licenseKey: null } });
    const onNeedLicense = vi.fn();
    const { container } = render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={vi.fn()} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} onNeedLicense={onNeedLicense} />);

    expect(container.querySelectorAll(".effect-library-item.locked")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "添加 3D 终端 到时间线", hidden: true }));
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips).toHaveLength(1);
    expect(onNeedLicense).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: "添加 金句强调条 到时间线", hidden: true }));
    expect(useEditorStore.getState().project.tracks.find((track) => track.kind === "composition")!.clips[0]).toMatchObject({
      accentColor: "#47d7ac",
      colorRole: "opinion"
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
    fireEvent.change(search, { target: { value: "误区" } });

    expect(screen.getByText("双栏对比")).toBeInTheDocument();
    expect(screen.queryByText("金句强调条")).not.toBeInTheDocument();
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
    expect(subtitleActions).toHaveTextContent("生成配音");
    expect(subtitleActions?.previousElementSibling).toBe(subtitleLibrary);
    expect(screen.queryByRole("button", { name: "匹配" })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "动效" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: "匹配" }));
    expect(onMatchEffects).toHaveBeenCalledOnce();
  });

  it("matches sounds separately without duplicating subtitle color settings", () => {
    useEditorStore.setState({ project: createEmptyProject(), selectedClipId: null, selectedClipIds: [], playheadUs: 0, past: [], future: [] });
    const onMatchEffects = vi.fn();
    const onMatchSounds = vi.fn();
    render(<AssetPanel onImport={vi.fn()} onGenerate={vi.fn()} onMatchEffects={onMatchEffects} onMatchSounds={onMatchSounds} onTranscribe={vi.fn()} onExtractAudio={vi.fn()} onExportAudio={vi.fn()} onRelink={vi.fn()} onCreateAudio={vi.fn()} onManageEffects={vi.fn()} />);
    expect(screen.getByRole("button", { name: "匹配" })).toBeDisabled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "音效" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("button", { name: "匹配" })).toBeDisabled();
    act(() => useEditorStore.getState().addGeneratedPlan({ title: "测试", article: "测试文章", narration: "测试口播", captions: [{ startSeconds: 0, endSeconds: 3, text: "核心内容" }], scenes: [], matches: [] }, "", "overlay"));
    fireEvent.click(screen.getByRole("button", { name: "匹配" }));
    expect(onMatchSounds).toHaveBeenCalledOnce();
    expect(onMatchEffects).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "字幕" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("radiogroup", { name: "字幕文字色" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "字幕关键词色" })).not.toBeInTheDocument();
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
    expect(document.querySelector('input[type="color"]')).toBeNull();
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "字幕文字色" })).getByRole("radio", { name: "青绿" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "字幕关键词色" })).getByRole("radio", { name: "珊瑚" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "字幕背景色" })).getByRole("radio", { name: "纯黑" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "字幕描边色" })).getByRole("radio", { name: "天蓝" }));
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
    expect(subtitles).toEqual([
      expect.objectContaining({ color: "#47d7ac", highlightColor: "#ff7b72", backgroundColor: "#000000", outlineColor: "#5fa8ff" }),
      expect.objectContaining({ color: "#47d7ac", highlightColor: "#ff7b72", backgroundColor: "#000000", outlineColor: "#5fa8ff" })
    ]);
    expect(useEditorStore.getState().project.subtitleTheme).toEqual({ color: "#47d7ac", highlightColor: "#ff7b72" });
  });
});
